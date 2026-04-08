import type Database from 'better-sqlite3';
import type { RepairPlanResult, RepairPlanStep, RepairPlanRow } from '@mcptoolshop/game-foundry-registry';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { getRepairContract } from './repair-catalog.js';
import { runDiagnostics } from './diagnostics.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Check preconditions for a repair action.
 */
function checkPreconditions(
  db: Database.Database,
  preconditions: string[],
  projectId: string,
  projectRoot: string,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const cond of preconditions) {
    switch (cond) {
      case 'project_exists_in_registry': {
        const proj = getProject(db, projectId);
        if (!proj) failures.push('Project not found in registry');
        break;
      }
      case 'project_godot_exists': {
        if (!fs.existsSync(path.join(projectRoot, 'project.godot'))) {
          failures.push('project.godot not found');
        }
        break;
      }
      default:
        // Unknown precondition — skip (not a blocker)
        break;
    }
  }

  return { passed: failures.length === 0, failures };
}

/**
 * Compute a deterministic fingerprint from the current diagnostic state.
 * Used to detect truth drift between plan and apply.
 */
function computeFingerprint(
  projectId: string,
  findings: Array<{ id: string; severity: string }>,
): string {
  const payload = JSON.stringify({
    project_id: projectId,
    findings: findings.map(f => ({ id: f.id, severity: f.severity })).sort((a, b) => a.id.localeCompare(b.id)),
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Build the step list for a repair action.
 */
function buildSteps(
  actionKey: string,
  target: string,
  expectedEffects: string[],
  riskLevel: string,
): RepairPlanStep[] {
  return expectedEffects.map((effect, i) => ({
    step_index: i,
    action: actionKey,
    target_path: target,
    expected_change: effect,
    risk: riskLevel as RepairPlanStep['risk'],
  }));
}

/**
 * Create a repair plan for the given findings and action.
 * Validates the action key, checks preconditions, computes a fingerprint,
 * and stores the plan in the DB.
 */
export function planRepair(
  db: Database.Database,
  projectId: string,
  findingIds: string[],
  actionKey: string,
  target: string,
  projectRoot: string,
): RepairPlanResult {
  // 1. Look up contract
  const contract = getRepairContract(actionKey);
  if (!contract) {
    throw new Error(`Unknown repair action: ${actionKey}`);
  }

  // 2. Check preconditions
  const preconditionCheck = checkPreconditions(db, contract.preconditions, projectId, projectRoot);

  // 3. Snapshot truth for fingerprint
  const diagnostics = runDiagnostics(db, projectId, projectRoot);
  const fingerprint = computeFingerprint(projectId, diagnostics.findings);

  // 4. Build steps
  const steps = buildSteps(actionKey, target, contract.expected_effects, contract.risk_level);

  // 5. Determine blockers
  const blockers: string[] = [...preconditionCheck.failures];

  // Check if any existing plan for these findings is already in a non-terminal state
  for (const findingId of findingIds) {
    const existing = db.prepare(`
      SELECT id, status FROM repair_plans
      WHERE project_id = ? AND action_key = ? AND status IN ('planned', 'dry_run_passed', 'applied')
      AND finding_ids_json LIKE ?
      ORDER BY created_at DESC LIMIT 1
    `).get(projectId, actionKey, `%${findingId}%`) as RepairPlanRow | undefined;

    if (existing) {
      blockers.push(`Finding "${findingId}" already has active plan ${existing.id} (status: ${existing.status})`);
    }
  }

  // 6. Determine risk class and approval status
  const riskClass = contract.risk_level === 'safe' ? 'safe_auto'
    : contract.risk_level === 'moderate' ? 'approval_required'
    : 'manual_only';
  const approvalStatus = riskClass === 'approval_required' ? 'pending_approval' : 'not_required';

  // 7. Insert into DB
  const planId = `rp_${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO repair_plans (id, project_id, finding_ids_json, action_key, target,
      plan_fingerprint, steps_json, expected_effects_json, preconditions_json, status,
      risk_class, approval_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    projectId,
    JSON.stringify(findingIds),
    actionKey,
    target,
    fingerprint,
    JSON.stringify(steps),
    JSON.stringify(contract.expected_effects),
    JSON.stringify(preconditionCheck),
    blockers.length > 0 ? 'escalated' : 'planned',
    riskClass,
    approvalStatus,
  );

  return {
    plan_id: planId,
    action_key: actionKey,
    finding_ids: findingIds,
    steps,
    expected_effects: contract.expected_effects,
    precondition_check: preconditionCheck,
    plan_fingerprint: fingerprint,
    can_dry_run: contract.dry_run_supported && blockers.length === 0,
    can_apply: blockers.length === 0,
    blockers,
  };
}

/**
 * Retrieve a repair plan by ID.
 */
export function getRepairPlan(db: Database.Database, planId: string): RepairPlanRow | undefined {
  return db.prepare('SELECT * FROM repair_plans WHERE id = ?').get(planId) as RepairPlanRow | undefined;
}

/**
 * Approve a pending moderate-risk repair plan.
 * Validates the fingerprint is still current — approval expires if truth drifted.
 */
export function approveRepairPlan(
  db: Database.Database,
  planId: string,
  approvedBy: string,
  projectRoot?: string,
): { plan_id: string; approval_status: string } {
  const plan = db.prepare('SELECT * FROM repair_plans WHERE id = ?').get(planId) as any;
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const currentApproval = plan.approval_status ?? 'not_required';
  if (currentApproval !== 'pending_approval') {
    throw new Error(`Cannot approve plan with approval_status "${currentApproval}" — must be "pending_approval"`);
  }

  // Validate fingerprint if projectRoot provided
  if (projectRoot) {
    const diagnostics = runDiagnostics(db, plan.project_id, projectRoot);
    const currentFp = computeFingerprint(plan.project_id, diagnostics.findings);
    if (currentFp !== plan.plan_fingerprint) {
      db.prepare("UPDATE repair_plans SET approval_status = 'not_required', status = 'failed' WHERE id = ?").run(planId);
      throw new Error('Approval rejected: truth has changed since planning — plan fingerprint is stale');
    }
  }

  db.prepare(`
    UPDATE repair_plans SET approval_status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?
  `).run(approvedBy, planId);

  return { plan_id: planId, approval_status: 'approved' };
}

/**
 * Reject a pending repair plan.
 */
export function rejectRepairPlan(
  db: Database.Database,
  planId: string,
  reason: string,
): { plan_id: string; approval_status: string } {
  const plan = db.prepare('SELECT * FROM repair_plans WHERE id = ?').get(planId) as any;
  if (!plan) throw new Error(`Plan not found: ${planId}`);

  const currentApproval = plan.approval_status ?? 'not_required';
  if (currentApproval !== 'pending_approval') {
    throw new Error(`Cannot reject plan with approval_status "${currentApproval}" — must be "pending_approval"`);
  }

  db.prepare("UPDATE repair_plans SET approval_status = 'rejected', status = 'failed' WHERE id = ?").run(planId);

  // Emit state event
  db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(plan.project_id, 'repair', planId, 'pending_approval', 'rejected', reason, 'studio_reject_repair');

  return { plan_id: planId, approval_status: 'rejected' };
}
