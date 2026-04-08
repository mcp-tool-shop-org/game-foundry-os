import type Database from 'better-sqlite3';
import type {
  ProofRunRow,
  FreezeCandidateRow,
  FreezeReceiptRow,
  RegressionRow,
} from '@mcptoolshop/game-foundry-registry';

export interface ProofTimelineEntry {
  timestamp: string;
  type: 'proof_run' | 'freeze_candidate' | 'freeze_receipt' | 'regression' | 'state_event';
  summary: string;
  detail: Record<string, unknown>;
}

export function getProofTimeline(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): ProofTimelineEntry[] {
  const entries: ProofTimelineEntry[] = [];

  // Proof runs
  const runs = db.prepare(`
    SELECT * FROM proof_runs WHERE project_id = ? AND scope_type = ? AND scope_id = ?
    ORDER BY created_at
  `).all(projectId, scopeType, scopeId) as ProofRunRow[];

  for (const r of runs) {
    entries.push({
      timestamp: r.created_at,
      type: 'proof_run',
      summary: `Proof run ${r.id}: ${r.result} (${r.blocking_failures} failures, ${r.warning_count} warnings)`,
      detail: { id: r.id, result: r.result, suite_id: r.suite_id, tool_name: r.tool_name },
    });
  }

  // Freeze candidates
  const candidates = db.prepare(`
    SELECT * FROM freeze_candidates WHERE project_id = ? AND scope_type = ? AND scope_id = ?
    ORDER BY created_at
  `).all(projectId, scopeType, scopeId) as FreezeCandidateRow[];

  for (const c of candidates) {
    entries.push({
      timestamp: c.created_at,
      type: 'freeze_candidate',
      summary: `Freeze candidate ${c.id}: ${c.status}`,
      detail: { id: c.id, status: c.status, candidate_hash: c.candidate_hash },
    });
  }

  // Freeze receipts
  const receipts = db.prepare(`
    SELECT * FROM freeze_receipts WHERE project_id = ? AND scope_type = ? AND scope_id = ?
    ORDER BY created_at
  `).all(projectId, scopeType, scopeId) as FreezeReceiptRow[];

  for (const r of receipts) {
    entries.push({
      timestamp: r.created_at,
      type: 'freeze_receipt',
      summary: `Freeze receipt ${r.id}: ${r.freeze_summary ?? 'frozen'}`,
      detail: { id: r.id, receipt_hash: r.receipt_hash, source_candidate_id: r.source_candidate_id },
    });
  }

  // Regressions
  const regressions = db.prepare(`
    SELECT * FROM regressions WHERE project_id = ? AND scope_type = ? AND scope_id = ?
    ORDER BY created_at
  `).all(projectId, scopeType, scopeId) as RegressionRow[];

  for (const reg of regressions) {
    entries.push({
      timestamp: reg.created_at,
      type: 'regression',
      summary: `Regression ${reg.id}: ${reg.regression_type} (${reg.severity})`,
      detail: { id: reg.id, regression_type: reg.regression_type, severity: reg.severity },
    });
  }

  // State events related to this scope
  const events = db.prepare(`
    SELECT * FROM state_events WHERE project_id = ? AND entity_type = ? AND entity_id = ?
    ORDER BY created_at
  `).all(projectId, scopeType, scopeId) as Array<{ created_at: string; from_state: string | null; to_state: string; reason: string | null; tool_name: string | null }>;

  for (const e of events) {
    entries.push({
      timestamp: e.created_at,
      type: 'state_event',
      summary: `${e.from_state ?? '(none)'} -> ${e.to_state}${e.reason ? ': ' + e.reason : ''}`,
      detail: { from_state: e.from_state, to_state: e.to_state, reason: e.reason, tool_name: e.tool_name },
    });
  }

  // Sort chronologically
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return entries;
}
