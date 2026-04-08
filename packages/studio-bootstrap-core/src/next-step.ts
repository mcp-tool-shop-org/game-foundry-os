import type Database from 'better-sqlite3';
import type { StudioNextStepV3, DiagnosticFinding, QualityDomain } from '@mcptoolshop/game-foundry-registry';
import { getLatestBootstrap } from './bootstrap.js';
import { runDiagnostics } from './diagnostics.js';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { getRepairContract } from './repair-catalog.js';
import { findingToDomain } from './quality-domains.js';

/** @deprecated Use StudioNextStepV3 */
export interface StudioNextStep {
  action: string;
  reason: string;
  priority: 'critical' | 'normal' | 'low';
  source: string | null;
}

/** @deprecated Use StudioNextStepV3 */
export type StudioNextStepV2 = StudioNextStepV3;

/** Game-oriented explanation for why a domain blocker matters */
const DOMAIN_WHY: Record<QualityDomain, string> = {
  playability_integrity: 'The game cannot be verified as playable without proof infrastructure',
  runtime_integrity: 'The game cannot launch without this runtime component',
  visual_integrity: 'Pixel-art rendering will be broken or degraded in engine',
  encounter_integrity: 'Combat encounters will be missing or broken at runtime',
  canon_integrity: 'Design documentation is disconnected from production state',
  shipping_integrity: 'The game cannot be exported or distributed',
};

/** Domain priority weights — lower = higher priority */
const DOMAIN_WEIGHT: Record<QualityDomain, number> = {
  playability_integrity: 0,
  runtime_integrity: 1,
  visual_integrity: 2,
  encounter_integrity: 3,
  canon_integrity: 4,
  shipping_integrity: 5,
};

/** Sort findings by domain weight (game impact), then severity */
function sortByQualityPriority(findings: DiagnosticFinding[]): DiagnosticFinding[] {
  const severityWeight = { critical: 0, major: 1, minor: 2 };
  return [...findings].sort((a, b) => {
    const domA = DOMAIN_WEIGHT[findingToDomain(a)] ?? 9;
    const domB = DOMAIN_WEIGHT[findingToDomain(b)] ?? 9;
    if (domA !== domB) return domA - domB;
    return (severityWeight[a.severity] ?? 3) - (severityWeight[b.severity] ?? 3);
  });
}

function makeStep(
  action: string,
  actionKey: string | null,
  target: string | null,
  reason: string,
  priority: 'critical' | 'normal' | 'low',
  source: string | null,
  canDryRun: boolean,
  canApply: boolean,
  expectedOutcome: string,
  domain: QualityDomain | null,
  whyItMatters: string,
): StudioNextStepV3 {
  return {
    action, action_key: actionKey, target, reason, priority, source,
    can_dry_run: canDryRun, can_apply: canApply, expected_outcome: expectedOutcome,
    quality_domain: domain, why_it_matters: whyItMatters,
  };
}

/**
 * Deterministic next-step engine — quality-domain aware.
 *
 * Priority: playability > runtime > visual > encounter > canon > shipping.
 * Within each domain: critical > major > minor. Repairable outranks non-repairable.
 */
export function getStudioNextStep(db: Database.Database, projectId: string): StudioNextStepV3 {
  // ── Priority 0: Project must exist ──────────────────────
  const project = getProject(db, projectId);
  if (!project) {
    return makeStep('create_project', null, null,
      'Project does not exist in registry', 'critical', null,
      false, false, 'Project registered in foundry',
      null, 'The project must be registered before any work can begin');
  }

  // ── Priority 0.5: Bootstrap must exist and pass ─────────
  const bootstrap = getLatestBootstrap(db, projectId);
  if (!bootstrap) {
    return makeStep('bootstrap_template', null, project.root_path,
      'No bootstrap record found — run full template bootstrap', 'critical', null,
      false, true, 'Project bootstrapped from template',
      null, 'The project needs a bootstrap record to track its setup state');
  }
  if (bootstrap.result === 'pending') {
    return makeStep('complete_bootstrap', null, project.root_path,
      'Bootstrap started but not completed', 'critical', null,
      false, true, 'Bootstrap completed',
      null, 'The bootstrap must complete before production can begin');
  }
  if (bootstrap.result === 'fail') {
    return makeStep('retry_bootstrap', null, project.root_path,
      'Previous bootstrap failed — review errors and retry', 'critical', null,
      false, true, 'Bootstrap retried successfully',
      null, 'The bootstrap failed and must be retried');
  }

  // ── Diagnostics: sort by domain quality priority ────────
  const targetPath = project.root_path;
  const diagnostics = runDiagnostics(db, projectId, targetPath);
  const sorted = sortByQualityPriority(diagnostics.findings);

  // Find the highest-priority repairable finding
  const repairableBlocker = sorted.find(f => f.severity === 'critical' && f.repairable && f.repair_action);
  if (repairableBlocker) {
    const contract = getRepairContract(repairableBlocker.repair_action!);
    const domain = findingToDomain(repairableBlocker);
    return makeStep(
      repairableBlocker.repair_action!, repairableBlocker.repair_action!, targetPath,
      repairableBlocker.message, 'critical', repairableBlocker.source_tool,
      contract?.dry_run_supported ?? false, true,
      contract?.expected_effects.join('; ') ?? 'Repair applied',
      domain, DOMAIN_WHY[domain],
    );
  }

  // Non-repairable critical
  const nonRepairableBlocker = sorted.find(f => f.severity === 'critical' && !f.repairable);
  if (nonRepairableBlocker) {
    const domain = findingToDomain(nonRepairableBlocker);
    return makeStep(
      `fix: ${nonRepairableBlocker.id}`, null, targetPath,
      nonRepairableBlocker.message, 'critical', nonRepairableBlocker.source_tool,
      false, false, 'Manual fix required',
      domain, DOMAIN_WHY[domain],
    );
  }

  // Major findings
  const majorFinding = sorted.find(f => f.severity === 'major');
  if (majorFinding) {
    const domain = findingToDomain(majorFinding);
    if (majorFinding.repairable && majorFinding.repair_action) {
      const contract = getRepairContract(majorFinding.repair_action);
      return makeStep(
        majorFinding.repair_action, majorFinding.repair_action, targetPath,
        majorFinding.message, 'normal', majorFinding.source_tool,
        contract?.dry_run_supported ?? false, true,
        contract?.expected_effects.join('; ') ?? 'Repair applied',
        domain, DOMAIN_WHY[domain],
      );
    }
    return makeStep(
      `resolve: ${majorFinding.id}`, null, targetPath,
      majorFinding.message, 'normal', majorFinding.source_tool,
      false, false, 'Manual resolution required',
      domain, DOMAIN_WHY[domain],
    );
  }

  // ── Production readiness: proof suggestion ──────────────
  const charCount = (db.prepare(
    'SELECT COUNT(*) as count FROM characters WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (charCount === 0) {
    return makeStep('create_character', null, null,
      'No characters registered — create your first character to begin production', 'normal', null,
      false, true, 'First character created',
      null, 'Characters are needed to populate encounters and test combat');
  }

  const encounterCount = (db.prepare(
    'SELECT COUNT(*) as count FROM encounters WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (encounterCount === 0) {
    return makeStep('create_encounter', null, null,
      'No encounters defined — create your first encounter to test combat', 'normal', null,
      false, true, 'First encounter created',
      null, 'Encounters are needed to build and prove combat slices');
  }

  // If config-compliant but no proof runs exist, suggest proof
  const proofCount = (db.prepare(
    'SELECT COUNT(*) as count FROM proof_runs WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (proofCount === 0) {
    return makeStep('run_proof_suite', null, targetPath,
      'Project is config-compliant but not slice-provable — run proof suites to verify playability', 'normal', null,
      false, true, 'Proof suites run, playability verified',
      'playability_integrity', 'The project looks set up but has never been verified as playable');
  }

  return makeStep('continue_production', null, null,
    'All bootstrap shells installed — continue with sprite and encounter production', 'low', null,
    false, false, 'Production continues',
    null, 'The project is healthy and ready for content production');
}
