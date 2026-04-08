import type Database from 'better-sqlite3';
import type {
  RepairApplyResult,
  RepairStepResultEntry,
  RepairPlanRow,
  ProjectHealthStatus,
} from '@mcptoolshop/game-foundry-registry';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { getRepairContract } from './repair-catalog.js';
import { runDiagnostics } from './diagnostics.js';
import { getProjectStatus } from './project-status.js';
import { installRuntimeShell } from './install-runtime.js';
import { installThemeShell } from './install-theme.js';
import { installProofShell } from './install-proof.js';
import { seedProjectRegistry } from './seed-registry.js';
import { seedVault } from './seed-vault.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Recompute the diagnostic fingerprint to check for truth drift.
 */
function recomputeFingerprint(
  db: Database.Database,
  projectId: string,
  projectRoot: string,
): string {
  const diagnostics = runDiagnostics(db, projectId, projectRoot);
  const payload = JSON.stringify({
    project_id: projectId,
    findings: diagnostics.findings
      .map(f => ({ id: f.id, severity: f.severity }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

/**
 * Execute a studio shell repair action.
 * Returns the list of changed targets.
 */
function executeStudioAction(
  db: Database.Database,
  actionKey: string,
  projectId: string,
  projectRoot: string,
  dryRun: boolean,
): { changes: string[]; success: boolean } {
  if (dryRun) {
    // Dry-run: report what would change without executing
    const contract = getRepairContract(actionKey);
    return { changes: contract?.expected_effects ?? [], success: true };
  }

  switch (actionKey) {
    case 'studio_install_runtime_shell': {
      const result = installRuntimeShell(db, projectId, projectRoot);
      return { changes: result.paths, success: result.files_created > 0 };
    }
    case 'studio_install_theme_shell': {
      const result = installThemeShell(db, projectId, projectRoot);
      return { changes: [`${result.files_created} theme files created`], success: result.files_created > 0 };
    }
    case 'studio_install_proof_shell': {
      const result = installProofShell(db, projectId);
      return {
        changes: [`${result.suites_created} suites, ${result.policies_created} policies`],
        success: result.suites_created > 0,
      };
    }
    case 'studio_seed_vault': {
      const vaultPath = path.join(projectRoot, 'canon');
      const result = seedVault(db, projectId, vaultPath, 'combat_first');
      return {
        changes: result.paths.length > 0 ? result.paths : [`${result.pages_created} pages created`],
        success: true,
      };
    }
    case 'studio_seed_registry': {
      const result = seedProjectRegistry(db, projectId, 'godot-tactics-template');
      return {
        changes: [`${result.suites_created} suites, ${result.policies_created} policies`],
        success: result.suites_created > 0 || result.policies_created > 0,
      };
    }
    default:
      return { changes: [], success: false };
  }
}

/**
 * Execute a Godot config repair action.
 */
function executeGodotAction(
  actionKey: string,
  projectRoot: string,
  _params: Record<string, unknown>,
  dryRun: boolean,
): { changes: string[]; success: boolean } {
  // Godot mutations are loaded dynamically to avoid circular deps
  // For now, godot actions that require specific params (name, path, etc.)
  // are not auto-dispatchable — they require explicit params from the plan.
  // The repair engine treats these as escalation-only in v1.3.0 unless
  // the plan includes explicit params.

  if (dryRun) {
    const contract = getRepairContract(actionKey);
    return { changes: contract?.expected_effects ?? [], success: true };
  }

  // v1.3.0: godot actions with specific params can be executed when params are known
  // For now, return success=false to indicate escalation needed
  return { changes: [], success: false };
}

/**
 * Apply a repair plan in dry_run or apply mode.
 * Validates the plan fingerprint, executes the action, runs postchecks,
 * and records a receipt.
 */
export function applyRepair(
  db: Database.Database,
  projectId: string,
  planId: string,
  mode: 'dry_run' | 'apply',
  projectRoot: string,
): RepairApplyResult {
  // 1. Load plan
  const plan = db.prepare('SELECT * FROM repair_plans WHERE id = ?').get(planId) as RepairPlanRow | undefined;
  if (!plan) throw new Error(`Repair plan not found: ${planId}`);
  if (plan.project_id !== projectId) throw new Error(`Plan ${planId} belongs to project ${plan.project_id}, not ${projectId}`);

  // Only allow execution from valid states
  const validStates = ['planned', 'dry_run_passed'];
  if (!validStates.includes(plan.status)) {
    throw new Error(`Cannot execute plan in status "${plan.status}" — must be ${validStates.join(' or ')}`);
  }

  // 2. Check approval gate (moderate-risk plans require approval)
  const riskClass = (plan as any).risk_class ?? 'safe_auto';
  if (riskClass === 'approval_required') {
    const approvalStatus = (plan as any).approval_status ?? 'not_required';
    if (approvalStatus !== 'approved') {
      throw new Error(
        `Plan ${planId} requires approval before execution (risk_class: ${riskClass}, approval_status: ${approvalStatus})`
      );
    }
  }

  // 3. Validate fingerprint (reject if truth drifted)
  const currentFingerprint = recomputeFingerprint(db, projectId, projectRoot);
  if (currentFingerprint !== plan.plan_fingerprint) {
    db.prepare("UPDATE repair_plans SET status = 'failed' WHERE id = ?").run(planId);
    throw new Error(`Plan fingerprint mismatch: truth has changed since planning. Plan: ${plan.plan_fingerprint}, Current: ${currentFingerprint}`);
  }

  // 3. Snapshot "before" state
  const statusBefore = getProjectStatus(db, projectId);
  const diagBefore = runDiagnostics(db, projectId, projectRoot);
  const findingIdsBefore = new Set(diagBefore.findings.map(f => f.id));

  const dryRun = mode === 'dry_run';

  // 4. Execute the action
  const contract = getRepairContract(plan.action_key);
  let stepResults: RepairStepResultEntry[];
  let changedTargets: string[] = [];

  if (contract?.scope === 'godot_config') {
    const result = executeGodotAction(plan.action_key, projectRoot, {}, dryRun);
    changedTargets = result.changes;
    stepResults = JSON.parse(plan.steps_json).map((step: any, i: number) => ({
      step_index: i,
      result: result.success ? (dryRun ? 'attempted' : 'applied') : 'failed',
      detail: result.changes[i] ?? plan.action_key,
    }));
  } else {
    const result = executeStudioAction(db, plan.action_key, projectId, projectRoot, dryRun);
    changedTargets = result.changes;
    stepResults = JSON.parse(plan.steps_json).map((step: any, i: number) => ({
      step_index: i,
      result: result.success ? (dryRun ? 'attempted' : 'applied') : 'failed',
      detail: result.changes[i] ?? plan.action_key,
    }));
  }

  // 5. Post-checks and verification (only in apply mode)
  let verification: RepairApplyResult['verification'] = null;
  let statusDelta: RepairApplyResult['status_delta'] = null;

  if (!dryRun) {
    const diagAfter = runDiagnostics(db, projectId, projectRoot);
    const findingIdsAfter = new Set(diagAfter.findings.map(f => f.id));

    const findingsCleared = [...findingIdsBefore].filter(id => !findingIdsAfter.has(id));
    const findingsNew = [...findingIdsAfter].filter(id => !findingIdsBefore.has(id));

    verification = {
      ran: true,
      passed: findingsNew.length === 0,
      findings_cleared: findingsCleared,
      new_findings: findingsNew,
    };

    // Compute status delta
    const statusAfter = getProjectStatus(db, projectId);
    if (statusBefore.status !== statusAfter.status) {
      statusDelta = { from: statusBefore.status, to: statusAfter.status };
    }

    // Regressions are inserted after receipt creation (see below)
  }

  // 6. Compute receipt hash
  const receiptHash = crypto.createHash('sha256')
    .update(`${planId}:${mode}:${JSON.stringify(stepResults)}:${new Date().toISOString()}`)
    .digest('hex')
    .slice(0, 16);

  // 7. Insert receipt
  const receiptId = `rr_${crypto.randomUUID().slice(0, 12)}`;
  const receiptStatus = stepResults.every(s => s.result === 'applied' || s.result === 'attempted')
    ? (dryRun ? 'pass' : (verification?.passed ? 'pass' : 'partial'))
    : 'fail';

  db.prepare(`
    INSERT INTO repair_receipts (id, project_id, plan_id, action_key, mode,
      before_json, after_json, changed_targets_json, step_results_json,
      verification_json, status_delta_json, receipt_hash, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    receiptId,
    projectId,
    planId,
    plan.action_key,
    mode,
    JSON.stringify({ status: statusBefore.status, blocker_count: diagBefore.blocker_count }),
    verification ? JSON.stringify({ findings_cleared: verification.findings_cleared.length }) : null,
    JSON.stringify(changedTargets),
    JSON.stringify(stepResults),
    verification ? JSON.stringify(verification) : null,
    statusDelta ? JSON.stringify(statusDelta) : null,
    receiptHash,
    receiptStatus,
  );

  // 8. Update plan status
  let newPlanStatus: string;
  if (dryRun) {
    newPlanStatus = 'dry_run_passed';
  } else if (verification?.passed) {
    newPlanStatus = 'verified';
  } else if (verification && !verification.passed) {
    newPlanStatus = 'escalated';
  } else {
    newPlanStatus = 'applied';
  }
  db.prepare('UPDATE repair_plans SET status = ? WHERE id = ?').run(newPlanStatus, planId);

  // 9. Emit state event (apply mode only)
  if (!dryRun) {
    db.prepare(`
      INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      'repair',
      planId,
      plan.status,
      newPlanStatus,
      `Repair ${plan.action_key} ${mode}`,
      'studio_apply_repair',
      JSON.stringify({ receipt_id: receiptId, action_key: plan.action_key }),
    );
  }

  // Insert regression records for any new findings introduced by the repair
  if (!dryRun && verification && verification.new_findings.length > 0) {
    for (const newFinding of verification.new_findings) {
      const regId = `rreg_${crypto.randomUUID().slice(0, 12)}`;
      db.prepare(`
        INSERT INTO repair_regressions (id, project_id, receipt_id, regression_type, severity, details_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(regId, projectId, receiptId, 'repair_introduced', 'major', JSON.stringify({ finding_id: newFinding }));
    }
  }

  return {
    receipt_id: receiptId,
    plan_id: planId,
    action_key: plan.action_key,
    mode,
    step_results: stepResults,
    verification,
    status_delta: statusDelta,
    receipt_hash: receiptHash,
  };
}
