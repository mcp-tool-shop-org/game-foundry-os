import type Database from 'better-sqlite3';
import type {
  QualityDomain,
  QualityDomainState,
  QualityDomainStatus,
  DiagnosticFinding,
} from '@mcptoolshop/game-foundry-registry';
import { runDiagnostics } from './diagnostics.js';
import crypto from 'node:crypto';

/** All quality domains in priority order (highest game impact first) */
export const ALL_DOMAINS: QualityDomain[] = [
  'playability_integrity',
  'runtime_integrity',
  'visual_integrity',
  'encounter_integrity',
  'presentation_integrity',
  'canon_integrity',
  'shipping_integrity',
];

/**
 * Static map: finding ID prefix → quality domain.
 * Order matters — first match wins.
 */
const DOMAIN_RULES: Array<{ prefix: string; domain: QualityDomain }> = [
  { prefix: 'engine_', domain: 'runtime_integrity' },
  { prefix: 'shell_', domain: 'runtime_integrity' },
  { prefix: 'autoload_', domain: 'runtime_integrity' },
  { prefix: 'display_', domain: 'visual_integrity' },
  { prefix: 'import_', domain: 'visual_integrity' },
  { prefix: 'export_', domain: 'shipping_integrity' },
  { prefix: 'canon_', domain: 'canon_integrity' },
  { prefix: 'proof_', domain: 'playability_integrity' },
  { prefix: 'battle_', domain: 'presentation_integrity' },
  { prefix: 'encounter_', domain: 'encounter_integrity' },
];

/** Resolve a finding to its quality domain */
export function findingToDomain(finding: DiagnosticFinding): QualityDomain {
  for (const rule of DOMAIN_RULES) {
    if (finding.id.startsWith(rule.prefix)) {
      return rule.domain;
    }
  }
  // Default: runtime_integrity (unknown findings are runtime issues)
  return 'runtime_integrity';
}

/** Group findings by quality domain */
export function findingsByDomain(
  findings: DiagnosticFinding[],
): Record<QualityDomain, DiagnosticFinding[]> {
  const result: Record<QualityDomain, DiagnosticFinding[]> = {
    visual_integrity: [],
    runtime_integrity: [],
    encounter_integrity: [],
    presentation_integrity: [],
    canon_integrity: [],
    playability_integrity: [],
    shipping_integrity: [],
  };

  for (const finding of findings) {
    const domain = findingToDomain(finding);
    result[domain].push(finding);
  }

  return result;
}

/** Derive domain status from its findings */
function deriveDomainStatus(findings: DiagnosticFinding[]): QualityDomainStatus {
  if (findings.length === 0) return 'healthy';
  if (findings.some(f => f.severity === 'critical')) return 'blocked';
  if (findings.some(f => f.severity === 'major')) return 'degraded';
  return 'warning';
}

/** Determine the best next action for a domain */
function domainNextAction(findings: DiagnosticFinding[]): string | null {
  // Find the first repairable finding, prioritized by severity
  const sorted = [...findings].sort((a, b) => {
    const order = { critical: 0, major: 1, minor: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  const repairable = sorted.find(f => f.repairable && f.repair_action);
  if (repairable) return repairable.repair_action!;

  if (sorted.length > 0) return `fix: ${sorted[0].id}`;
  return null;
}

/**
 * Compute per-domain quality state from current diagnostics.
 */
export function computeQualityStates(
  db: Database.Database,
  projectId: string,
  projectRoot: string,
): QualityDomainState[] {
  const diagnostics = runDiagnostics(db, projectId, projectRoot);
  const grouped = findingsByDomain(diagnostics.findings);

  return ALL_DOMAINS.map(domain => {
    const domainFindings = grouped[domain];
    return {
      domain,
      status: deriveDomainStatus(domainFindings),
      blocker_count: domainFindings.filter(f => f.severity === 'critical').length,
      warning_count: domainFindings.filter(f => f.severity !== 'critical').length,
      finding_ids: domainFindings.map(f => f.id),
      next_action: domainNextAction(domainFindings),
    };
  });
}

/** Find the weakest (worst-status) domain */
export function getWeakestDomain(states: QualityDomainState[]): QualityDomainState | null {
  const statusOrder: Record<QualityDomainStatus, number> = {
    blocked: 0,
    degraded: 1,
    warning: 2,
    unknown: 3,
    healthy: 4,
  };

  const nonHealthy = states.filter(s => s.status !== 'healthy');
  if (nonHealthy.length === 0) return null;

  return nonHealthy.sort((a, b) => statusOrder[a.status] - statusOrder[b.status])[0];
}

/** Persist quality states to DB (replaces previous snapshot) */
export function persistQualityStates(
  db: Database.Database,
  projectId: string,
  states: QualityDomainState[],
): void {
  // Delete previous states for this project
  db.prepare('DELETE FROM quality_domain_states WHERE project_id = ?').run(projectId);

  const insert = db.prepare(`
    INSERT INTO quality_domain_states (id, project_id, domain, status, blocker_count, warning_count, finding_ids_json, next_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const state of states) {
    const id = `qd_${crypto.randomUUID().slice(0, 12)}`;
    insert.run(
      id, projectId, state.domain, state.status,
      state.blocker_count, state.warning_count,
      JSON.stringify(state.finding_ids),
      state.next_action,
    );
  }
}
