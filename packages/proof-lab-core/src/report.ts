import type Database from 'better-sqlite3';
import type { ProofRunRow } from '@mcptoolshop/game-foundry-registry';
import { getFreezeReadiness } from './freeze.js';
import { getAssertions } from './runs.js';
import { listRegressions } from './regressions.js';

export interface FreezeReportSuiteEntry {
  suite_key: string;
  suite_id: string;
  latest_result: string;
  blocking_failures: number;
  warning_count: number;
  assertions: Array<{ key: string; status: string; message: string | null }>;
  ran_at: string;
}

export interface FreezeReport {
  project_id: string;
  scope_type: string;
  scope_id: string;
  readiness: string;
  blockers: string[];
  warnings: string[];
  suites: FreezeReportSuiteEntry[];
  regressions: Array<{ id: string; type: string; severity: string; created_at: string }>;
  generated_at: string;
}

export function generateFreezeReport(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): FreezeReport {
  const readiness = getFreezeReadiness(db, projectId, scopeType, scopeId);

  // Get latest proof run per suite
  const suites = db.prepare(`
    SELECT * FROM proof_suites WHERE project_id = ? AND scope_type = ?
  `).all(projectId, scopeType) as Array<{ id: string; suite_key: string }>;

  const suiteEntries: FreezeReportSuiteEntry[] = [];

  for (const suite of suites) {
    const run = db.prepare(`
      SELECT * FROM proof_runs
      WHERE project_id = ? AND suite_id = ? AND scope_type = ? AND scope_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(projectId, suite.id, scopeType, scopeId) as ProofRunRow | undefined;

    if (run) {
      const assertions = getAssertions(db, run.id);
      suiteEntries.push({
        suite_key: suite.suite_key,
        suite_id: suite.id,
        latest_result: run.result,
        blocking_failures: run.blocking_failures,
        warning_count: run.warning_count,
        assertions: assertions.map(a => ({
          key: a.assertion_key,
          status: a.status,
          message: a.message,
        })),
        ran_at: run.created_at,
      });
    }
  }

  const regs = listRegressions(db, projectId, scopeType, scopeId);

  return {
    project_id: projectId,
    scope_type: scopeType,
    scope_id: scopeId,
    readiness: readiness.readiness,
    blockers: readiness.blocking_reasons,
    warnings: readiness.warning_reasons,
    suites: suiteEntries,
    regressions: regs.map(r => ({
      id: r.id,
      type: r.regression_type,
      severity: r.severity,
      created_at: r.created_at,
    })),
    generated_at: new Date().toISOString(),
  };
}
