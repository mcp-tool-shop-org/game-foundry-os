import type Database from 'better-sqlite3';
import type { ProofRunRow } from '@mcptoolshop/game-foundry-registry';

export interface ProofNextStepResult {
  scope_type: string;
  scope_id: string;
  latest_runs: Array<{ suite_key: string; result: string; created_at: string }>;
  missing_suites: string[];
  latest_failures: string[];
  policy_blockers: string[];
  recommended_action: string;
}

export function getProofNextStep(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): ProofNextStepResult {
  // Get all suites for this scope type
  const suites = db.prepare(`
    SELECT * FROM proof_suites WHERE project_id = ? AND scope_type = ?
  `).all(projectId, scopeType) as Array<{ id: string; suite_key: string; is_blocking: number }>;

  const latestRuns: Array<{ suite_key: string; result: string; created_at: string }> = [];
  const missingSuites: string[] = [];
  const latestFailures: string[] = [];

  for (const suite of suites) {
    const run = db.prepare(`
      SELECT * FROM proof_runs
      WHERE project_id = ? AND suite_id = ? AND scope_type = ? AND scope_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(projectId, suite.id, scopeType, scopeId) as ProofRunRow | undefined;

    if (!run) {
      missingSuites.push(suite.suite_key);
    } else {
      latestRuns.push({ suite_key: suite.suite_key, result: run.result, created_at: run.created_at });
      if (run.result === 'fail') {
        latestFailures.push(`${suite.suite_key}: ${run.blocking_failures} blocking failures`);
      }
    }
  }

  // Check freeze policies
  const policies = db.prepare(`
    SELECT * FROM freeze_policies WHERE project_id = ? AND scope_type = ? AND scope_id = ?
  `).all(projectId, scopeType, scopeId) as Array<{ policy_key: string; policy_json: string | null }>;
  const policyBlockers = policies
    .filter(p => p.policy_json && JSON.parse(p.policy_json).blocking)
    .map(p => p.policy_key);

  // Determine recommended action
  let recommendedAction: string;
  if (suites.length === 0) {
    recommendedAction = 'No proof suites registered — run asset/encounter/runtime suite to auto-create';
  } else if (missingSuites.length > 0) {
    recommendedAction = `Run missing suites: ${missingSuites.join(', ')}`;
  } else if (latestFailures.length > 0) {
    recommendedAction = `Fix failing suites: ${latestFailures.map(f => f.split(':')[0]).join(', ')}`;
  } else if (policyBlockers.length > 0) {
    recommendedAction = `Resolve policy blockers: ${policyBlockers.join(', ')}`;
  } else {
    recommendedAction = 'All suites pass — create freeze candidate';
  }

  return {
    scope_type: scopeType,
    scope_id: scopeId,
    latest_runs: latestRuns,
    missing_suites: missingSuites,
    latest_failures: latestFailures,
    policy_blockers: policyBlockers,
    recommended_action: recommendedAction,
  };
}
