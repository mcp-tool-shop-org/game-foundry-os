import type Database from 'better-sqlite3';
import type { ProofRunRow, ProofAssertionRow, ProofRunResult, AssertionStatus } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface CreateProofRunInput {
  project_id: string;
  suite_id?: string;
  scope_type: string;
  scope_id: string;
  result: ProofRunResult;
  blocking_failures: number;
  warning_count: number;
  summary?: string;
  details_json?: string;
  tool_name?: string;
}

export function createProofRun(db: Database.Database, input: CreateProofRunInput): ProofRunRow {
  const id = `pr_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const receiptHash = crypto.createHash('sha256')
    .update(`${input.scope_type}:${input.scope_id}:${input.result}:${now}`)
    .digest('hex')
    .slice(0, 16);

  db.prepare(`
    INSERT INTO proof_runs (id, project_id, suite_id, scope_type, scope_id, result,
      blocking_failures, warning_count, receipt_hash, summary, details_json, tool_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.project_id,
    input.suite_id ?? null,
    input.scope_type,
    input.scope_id,
    input.result,
    input.blocking_failures,
    input.warning_count,
    receiptHash,
    input.summary ?? null,
    input.details_json ?? null,
    input.tool_name ?? null,
  );

  return db.prepare('SELECT * FROM proof_runs WHERE id = ?').get(id) as ProofRunRow;
}

export function addAssertion(
  db: Database.Database,
  runId: string,
  assertionKey: string,
  status: AssertionStatus,
  message?: string,
  detailsJson?: string,
): ProofAssertionRow {
  const result = db.prepare(`
    INSERT INTO proof_assertions (proof_run_id, assertion_key, status, message, details_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(runId, assertionKey, status, message ?? null, detailsJson ?? null);

  return db.prepare('SELECT * FROM proof_assertions WHERE id = ?')
    .get(result.lastInsertRowid) as ProofAssertionRow;
}

export function getProofRun(db: Database.Database, id: string): ProofRunRow | undefined {
  return db.prepare('SELECT * FROM proof_runs WHERE id = ?').get(id) as ProofRunRow | undefined;
}

export function getLatestRun(
  db: Database.Database,
  scopeType: string,
  scopeId: string,
  suiteKey?: string,
): ProofRunRow | undefined {
  if (suiteKey) {
    return db.prepare(`
      SELECT pr.* FROM proof_runs pr
      LEFT JOIN proof_suites ps ON pr.suite_id = ps.id
      WHERE pr.scope_type = ? AND pr.scope_id = ? AND ps.suite_key = ?
      ORDER BY pr.created_at DESC, pr.rowid DESC LIMIT 1
    `).get(scopeType, scopeId, suiteKey) as ProofRunRow | undefined;
  }
  return db.prepare(`
    SELECT * FROM proof_runs
    WHERE scope_type = ? AND scope_id = ?
    ORDER BY created_at DESC, rowid DESC LIMIT 1
  `).get(scopeType, scopeId) as ProofRunRow | undefined;
}

export function listRuns(db: Database.Database, scopeType: string, scopeId: string): ProofRunRow[] {
  return db.prepare(`
    SELECT * FROM proof_runs
    WHERE scope_type = ? AND scope_id = ?
    ORDER BY created_at DESC
  `).all(scopeType, scopeId) as ProofRunRow[];
}

export function getAssertions(db: Database.Database, runId: string): ProofAssertionRow[] {
  return db.prepare('SELECT * FROM proof_assertions WHERE proof_run_id = ? ORDER BY id')
    .all(runId) as ProofAssertionRow[];
}
