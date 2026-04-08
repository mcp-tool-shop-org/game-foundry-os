import type Database from 'better-sqlite3';
import type { ProofRunRow, RegressionRow } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface DetectRegressionsResult {
  regressions_found: number;
  new_regressions: RegressionRow[];
}

export function detectRegressions(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): DetectRegressionsResult {
  // Get last two runs for this scope
  const runs = db.prepare(`
    SELECT * FROM proof_runs
    WHERE project_id = ? AND scope_type = ? AND scope_id = ?
    ORDER BY created_at DESC, rowid DESC LIMIT 2
  `).all(projectId, scopeType, scopeId) as ProofRunRow[];

  const newRegressions: RegressionRow[] = [];

  if (runs.length < 2) {
    return { regressions_found: 0, new_regressions: [] };
  }

  const [latest, previous] = runs;

  // Regression: latest fails after previous passed
  if (latest.result === 'fail' && previous.result === 'pass') {
    const regId = `reg_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(`
      INSERT INTO regressions (id, project_id, scope_type, scope_id, regression_type,
        from_run_id, to_run_id, severity, details_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      regId,
      projectId,
      scopeType,
      scopeId,
      'proof_regression',
      previous.id,
      latest.id,
      'critical',
      JSON.stringify({
        from_result: previous.result,
        to_result: latest.result,
        from_failures: previous.blocking_failures,
        to_failures: latest.blocking_failures,
      }),
    );
    const reg = db.prepare('SELECT * FROM regressions WHERE id = ?').get(regId) as RegressionRow;
    newRegressions.push(reg);
  }

  return { regressions_found: newRegressions.length, new_regressions: newRegressions };
}

export function listRegressions(
  db: Database.Database,
  projectId: string,
  scopeType?: string,
  scopeId?: string,
): RegressionRow[] {
  if (scopeType && scopeId) {
    return db.prepare(`
      SELECT * FROM regressions WHERE project_id = ? AND scope_type = ? AND scope_id = ?
      ORDER BY created_at DESC
    `).all(projectId, scopeType, scopeId) as RegressionRow[];
  }
  if (scopeType) {
    return db.prepare(`
      SELECT * FROM regressions WHERE project_id = ? AND scope_type = ?
      ORDER BY created_at DESC
    `).all(projectId, scopeType) as RegressionRow[];
  }
  return db.prepare('SELECT * FROM regressions WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId) as RegressionRow[];
}
