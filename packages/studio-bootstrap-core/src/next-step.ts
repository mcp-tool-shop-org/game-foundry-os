import type Database from 'better-sqlite3';
import { getLatestBootstrap } from './bootstrap.js';
import { runDiagnostics } from './diagnostics.js';
import { getProject } from '@mcptoolshop/game-foundry-registry';

export interface StudioNextStep {
  action: string;
  reason: string;
  priority: 'critical' | 'normal' | 'low';
  source: string | null;
}

/**
 * Deterministic next-step engine backed by diagnostics findings.
 *
 * Priority order:
 *   1. Project existence / bootstrap state (critical)
 *   2. Repairable critical findings from diagnostics
 *   3. Non-repairable critical findings
 *   4. Major findings (normal priority)
 *   5. Production moves (low priority)
 */
export function getStudioNextStep(db: Database.Database, projectId: string): StudioNextStep {
  // ── Priority 0: Project must exist in registry ───────────
  const project = getProject(db, projectId);
  if (!project) {
    return {
      action: 'create_project',
      reason: 'Project does not exist in registry',
      priority: 'critical',
      source: null,
    };
  }

  // ── Priority 0.5: Bootstrap must exist and pass ──────────
  const bootstrap = getLatestBootstrap(db, projectId);
  if (!bootstrap) {
    return {
      action: 'bootstrap_template',
      reason: 'No bootstrap record found — run full template bootstrap',
      priority: 'critical',
      source: null,
    };
  }

  if (bootstrap.result === 'pending') {
    return {
      action: 'complete_bootstrap',
      reason: 'Bootstrap started but not completed',
      priority: 'critical',
      source: null,
    };
  }

  if (bootstrap.result === 'fail') {
    return {
      action: 'retry_bootstrap',
      reason: 'Previous bootstrap failed — review errors and retry',
      priority: 'critical',
      source: null,
    };
  }

  // ── Priority 1-4: Run diagnostics and rank findings ──────
  const targetPath = project.root_path;
  const diagnostics = runDiagnostics(db, projectId, targetPath);

  // Priority 1: Repairable critical findings
  const repairableBlockers = diagnostics.findings.filter(
    f => f.severity === 'critical' && f.repairable && f.repair_action
  );
  if (repairableBlockers.length > 0) {
    const first = repairableBlockers[0];
    return {
      action: first.repair_action!,
      reason: first.message,
      priority: 'critical',
      source: first.source_tool,
    };
  }

  // Priority 2: Non-repairable critical findings
  const nonRepairableBlockers = diagnostics.findings.filter(
    f => f.severity === 'critical' && !f.repairable
  );
  if (nonRepairableBlockers.length > 0) {
    const first = nonRepairableBlockers[0];
    return {
      action: `fix: ${first.id}`,
      reason: first.message,
      priority: 'critical',
      source: first.source_tool,
    };
  }

  // Priority 3: Major findings
  const majorFindings = diagnostics.findings.filter(f => f.severity === 'major');
  if (majorFindings.length > 0) {
    const repairable = majorFindings.find(f => f.repairable && f.repair_action);
    if (repairable) {
      return {
        action: repairable.repair_action!,
        reason: repairable.message,
        priority: 'normal',
        source: repairable.source_tool,
      };
    }
    return {
      action: `resolve: ${majorFindings[0].id}`,
      reason: majorFindings[0].message,
      priority: 'normal',
      source: majorFindings[0].source_tool,
    };
  }

  // ── Priority 5: Production readiness checks ──────────────
  const charCount = (db.prepare(
    'SELECT COUNT(*) as count FROM characters WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (charCount === 0) {
    return {
      action: 'create_character',
      reason: 'No characters registered — create your first character to begin production',
      priority: 'normal',
      source: null,
    };
  }

  const encounterCount = (db.prepare(
    'SELECT COUNT(*) as count FROM encounters WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (encounterCount === 0) {
    return {
      action: 'create_encounter',
      reason: 'No encounters defined — create your first encounter to test combat',
      priority: 'normal',
      source: null,
    };
  }

  return {
    action: 'continue_production',
    reason: 'All bootstrap shells installed — continue with sprite and encounter production',
    priority: 'low',
    source: null,
  };
}
