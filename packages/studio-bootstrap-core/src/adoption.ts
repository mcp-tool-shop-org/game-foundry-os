import type Database from 'better-sqlite3';
import type {
  AdoptionProfile,
  AdoptionPlan,
  AdoptionStage,
  RepairRiskClass,
  DiagnosticFinding,
  BootstrapDiagnosticResult,
  AdoptionPlanRow,
} from '@mcptoolshop/game-foundry-registry';
import { getRepairContract } from './repair-catalog.js';
import crypto from 'node:crypto';

/** Stage definitions — what each adoption stage means */
const STAGE_DEFS: Array<Omit<AdoptionStage, 'status'>> = [
  {
    stage: 1,
    name: 'Truth + Diagnostics',
    description: 'Register project, run diagnostics — no mutations',
    actions: ['import_existing_project', 'studio_bootstrap_diagnostics'],
  },
  {
    stage: 2,
    name: 'Safe Closure',
    description: 'Execute all safe shell and config repairs',
    actions: ['studio_install_runtime_shell', 'studio_install_theme_shell', 'studio_install_proof_shell', 'studio_seed_vault', 'studio_seed_registry'],
  },
  {
    stage: 3,
    name: 'Quality Repairs',
    description: 'Execute approval-required repairs after review',
    actions: ['godot_register_autoload', 'godot_enable_plugin', 'godot_apply_display_setting', 'godot_apply_rendering_setting', 'godot_seed_export_preset'],
  },
  {
    stage: 4,
    name: 'Proof Readiness',
    description: 'Run proof suites, ensure a slice is testable',
    actions: ['proof_run_asset_suite', 'proof_run_encounter_suite', 'proof_run_runtime_suite', 'proof_get_freeze_readiness'],
  },
  {
    stage: 5,
    name: 'Freeze Posture',
    description: 'Freeze candidates, promotion, shipping check',
    actions: ['proof_freeze_candidate', 'proof_promote_freeze', 'export_audit'],
  },
];

/**
 * Classify a project into an adoption profile based on scan results and diagnostics.
 */
export function classifyProject(
  scan: Record<string, boolean>,
  diagnostics: BootstrapDiagnosticResult,
): AdoptionProfile {
  const hasProjectGodot = scan['project.godot'] ?? false;
  const hasShells = (scan['battle/scenes/battle_scene.gd'] ?? false) ||
                    (scan['battle_scene'] ?? false);
  const hasCanon = scan['canon/'] ?? scan['canon_vault'] ?? false;
  const hasSprites = scan['assets/sprites/'] ?? scan['sprites'] ?? false;

  const criticalCount = diagnostics.blocker_count;
  const totalFindings = diagnostics.findings.length;

  // Greenfield: nothing exists
  if (!hasProjectGodot && !hasShells && !hasCanon) {
    return 'greenfield';
  }

  // Late stage: everything mostly present, few findings
  if (hasProjectGodot && hasShells && criticalCount === 0 && totalFindings <= 3) {
    return 'late_stage_production';
  }

  // Vertical slice: project.godot + some shells, moderate issues
  if (hasProjectGodot && (hasShells || hasSprites)) {
    return 'vertical_slice';
  }

  // Retrofit: project.godot exists but shells mostly missing
  return 'retrofit_prototype';
}

/**
 * Partition diagnostic findings into risk classes using the repair catalog.
 */
export function partitionFindings(
  findings: DiagnosticFinding[],
): Record<RepairRiskClass, string[]> {
  const result: Record<RepairRiskClass, string[]> = {
    safe_auto: [],
    approval_required: [],
    manual_only: [],
    advisory: [],
  };

  for (const finding of findings) {
    if (!finding.repairable || !finding.repair_action) {
      // Non-repairable: minor = advisory, else manual_only
      if (finding.severity === 'minor') {
        result.advisory.push(finding.id);
      } else {
        result.manual_only.push(finding.id);
      }
      continue;
    }

    const contract = getRepairContract(finding.repair_action);
    if (!contract) {
      result.manual_only.push(finding.id);
      continue;
    }

    if (contract.risk_level === 'safe') {
      result.safe_auto.push(finding.id);
    } else if (contract.risk_level === 'moderate') {
      result.approval_required.push(finding.id);
    } else {
      result.manual_only.push(finding.id);
    }
  }

  return result;
}

/**
 * Generate a staged adoption plan for a project.
 */
export function generateAdoptionPlan(
  db: Database.Database,
  projectId: string,
  profile: AdoptionProfile,
  findings: DiagnosticFinding[],
): AdoptionPlan {
  const partitioned = partitionFindings(findings);

  // Determine starting stage based on profile
  let startStage = 1;
  if (profile === 'vertical_slice') startStage = 2;
  if (profile === 'late_stage_production') startStage = 4;

  // Build stages
  const stages: AdoptionStage[] = STAGE_DEFS.map(def => ({
    ...def,
    status: def.stage < startStage ? 'completed' as const : 'pending' as const,
  }));

  // Mark current stage as in_progress
  const currentStage = stages.find(s => s.status === 'pending');
  if (currentStage) currentStage.status = 'in_progress';

  // Compute completion
  const completed = stages.filter(s => s.status === 'completed').length;
  const completion = {
    total_stages: stages.length,
    completed_stages: completed,
    pct: Math.round((completed / stages.length) * 100),
  };

  // Best next move: first safe_auto finding, else first approval_required, else manual_only
  let bestNextMove = 'continue_production';
  if (partitioned.safe_auto.length > 0) {
    const finding = findings.find(f => f.id === partitioned.safe_auto[0]);
    bestNextMove = finding?.repair_action ?? 'studio_bootstrap_diagnostics';
  } else if (partitioned.approval_required.length > 0) {
    const finding = findings.find(f => f.id === partitioned.approval_required[0]);
    bestNextMove = finding?.repair_action ?? 'review_findings';
  } else if (partitioned.manual_only.length > 0) {
    bestNextMove = `fix: ${partitioned.manual_only[0]}`;
  }

  const planId = `ap_${crypto.randomUUID().slice(0, 12)}`;

  // Persist to DB
  db.prepare(`
    INSERT OR REPLACE INTO adoption_plans (id, project_id, profile, current_stage, stages_json, completion_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    planId, projectId, profile,
    currentStage?.stage ?? 1,
    JSON.stringify(stages),
    JSON.stringify(completion),
  );

  return {
    plan_id: planId,
    project_id: projectId,
    profile,
    stages,
    current_stage: currentStage?.stage ?? 1,
    completion,
    partitioned_findings: partitioned,
    best_next_move: bestNextMove,
  };
}

/**
 * Get the current adoption stage and its next actions.
 */
export function getAdoptionStage(
  db: Database.Database,
  projectId: string,
): { stage: AdoptionStage; next_actions: string[] } | null {
  const row = db.prepare(
    'SELECT * FROM adoption_plans WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(projectId) as AdoptionPlanRow | undefined;

  if (!row) return null;

  const stages: AdoptionStage[] = JSON.parse(row.stages_json);
  const current = stages.find(s => s.status === 'in_progress') ?? stages.find(s => s.status === 'pending');

  if (!current) return null;

  return {
    stage: current,
    next_actions: current.actions,
  };
}

/**
 * Advance the adoption plan to the next stage if current is complete.
 */
export function advanceAdoptionStage(
  db: Database.Database,
  projectId: string,
): AdoptionPlan | null {
  const row = db.prepare(
    'SELECT * FROM adoption_plans WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(projectId) as AdoptionPlanRow | undefined;

  if (!row) return null;

  const stages: AdoptionStage[] = JSON.parse(row.stages_json);

  // Find current in_progress stage and mark completed
  const current = stages.find(s => s.status === 'in_progress');
  if (current) current.status = 'completed';

  // Find next pending stage and mark in_progress
  const next = stages.find(s => s.status === 'pending');
  if (next) next.status = 'in_progress';

  const completed = stages.filter(s => s.status === 'completed').length;
  const completion = {
    total_stages: stages.length,
    completed_stages: completed,
    pct: Math.round((completed / stages.length) * 100),
  };

  db.prepare(`
    UPDATE adoption_plans SET current_stage = ?, stages_json = ?, completion_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(next?.stage ?? current?.stage ?? 1, JSON.stringify(stages), JSON.stringify(completion), row.id);

  return {
    plan_id: row.id,
    project_id: projectId,
    profile: row.profile as AdoptionProfile,
    stages,
    current_stage: next?.stage ?? current?.stage ?? 1,
    completion,
    partitioned_findings: { safe_auto: [], approval_required: [], manual_only: [], advisory: [] },
    best_next_move: next ? next.actions[0] ?? 'continue' : 'adoption_complete',
  };
}
