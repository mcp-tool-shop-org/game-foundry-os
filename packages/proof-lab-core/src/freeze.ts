import type Database from 'better-sqlite3';
import type {
  FreezeReadinessResult,
  FreezeCandidateRow,
  FreezeReceiptRow,
  ProofRunRow,
  FreezeReadiness,
} from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export function getFreezeReadiness(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): FreezeReadinessResult {
  // Get all blocking suites for this scope type
  const blockingSuites = db.prepare(`
    SELECT * FROM proof_suites WHERE project_id = ? AND scope_type = ? AND is_blocking = 1
  `).all(projectId, scopeType) as Array<{ id: string; suite_key: string; display_name: string }>;

  const latestRuns: ProofRunRow[] = [];
  const blockingReasons: string[] = [];
  const warningReasons: string[] = [];

  // Check each blocking suite
  for (const suite of blockingSuites) {
    const latestRun = db.prepare(`
      SELECT * FROM proof_runs
      WHERE project_id = ? AND suite_id = ? AND scope_type = ? AND scope_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(projectId, suite.id, scopeType, scopeId) as ProofRunRow | undefined;

    if (!latestRun) {
      blockingReasons.push(`Suite "${suite.suite_key}" has never run`);
    } else {
      latestRuns.push(latestRun);
      if (latestRun.result === 'fail') {
        blockingReasons.push(`Suite "${suite.suite_key}" failed (${latestRun.blocking_failures} blocking failures)`);
      }
    }
  }

  // Check non-blocking suites for warnings
  const nonBlockingSuites = db.prepare(`
    SELECT * FROM proof_suites WHERE project_id = ? AND scope_type = ? AND is_blocking = 0
  `).all(projectId, scopeType) as Array<{ id: string; suite_key: string }>;

  for (const suite of nonBlockingSuites) {
    const latestRun = db.prepare(`
      SELECT * FROM proof_runs
      WHERE project_id = ? AND suite_id = ? AND scope_type = ? AND scope_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(projectId, suite.id, scopeType, scopeId) as ProofRunRow | undefined;

    if (latestRun) {
      latestRuns.push(latestRun);
      if (latestRun.result === 'fail') {
        warningReasons.push(`Non-blocking suite "${suite.suite_key}" failed`);
      }
    }
  }

  // Also check proof_runs that have no suite_id (ad-hoc runs)
  const adHocRuns = db.prepare(`
    SELECT * FROM proof_runs
    WHERE project_id = ? AND scope_type = ? AND scope_id = ? AND suite_id IS NOT NULL
    AND id NOT IN (SELECT id FROM proof_runs WHERE id IN (${latestRuns.map(() => '?').join(',') || "'__none__'"}))
    ORDER BY created_at DESC
  `).all(projectId, scopeType, scopeId, ...latestRuns.map(r => r.id)) as ProofRunRow[];

  latestRuns.push(...adHocRuns);

  let readiness: FreezeReadiness;
  let nextAction: string;

  if (blockingReasons.length > 0) {
    readiness = 'blocked';
    nextAction = 'Fix blocking proof suite failures before freeze';
  } else if (warningReasons.length > 0) {
    readiness = 'warning_only';
    nextAction = 'Review warnings, then create freeze candidate';
  } else {
    readiness = 'ready';
    nextAction = 'Create freeze candidate';
  }

  return {
    scope_type: scopeType,
    scope_id: scopeId,
    readiness,
    blocking_reasons: blockingReasons,
    warning_reasons: warningReasons,
    latest_proof_runs: latestRuns,
    next_action: nextAction,
  };
}

export function createFreezeCandidate(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): FreezeCandidateRow {
  const readiness = getFreezeReadiness(db, projectId, scopeType, scopeId);
  const id = `fc_${crypto.randomUUID().slice(0, 12)}`;
  const status = readiness.readiness === 'blocked' ? 'blocked' : 'candidate';

  const candidateHash = crypto.createHash('sha256')
    .update(`${scopeType}:${scopeId}:${status}:${new Date().toISOString()}`)
    .digest('hex')
    .slice(0, 16);

  db.prepare(`
    INSERT INTO freeze_candidates (id, project_id, scope_type, scope_id, status,
      blocking_reasons_json, warning_reasons_json, candidate_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    projectId,
    scopeType,
    scopeId,
    status,
    readiness.blocking_reasons.length > 0 ? JSON.stringify(readiness.blocking_reasons) : null,
    readiness.warning_reasons.length > 0 ? JSON.stringify(readiness.warning_reasons) : null,
    candidateHash,
  );

  return db.prepare('SELECT * FROM freeze_candidates WHERE id = ?').get(id) as FreezeCandidateRow;
}

export function promoteFreeze(
  db: Database.Database,
  projectId: string,
  candidateId: string,
  overrideReason?: string,
): FreezeReceiptRow {
  const candidate = db.prepare('SELECT * FROM freeze_candidates WHERE id = ?').get(candidateId) as FreezeCandidateRow | undefined;
  if (!candidate) throw new Error(`Freeze candidate not found: ${candidateId}`);
  if (candidate.status !== 'candidate') {
    throw new Error(`Cannot promote candidate with status "${candidate.status}" — must be "candidate"`);
  }

  const receiptId = `fr_${crypto.randomUUID().slice(0, 12)}`;
  const receiptHash = crypto.createHash('sha256')
    .update(`${candidate.scope_type}:${candidate.scope_id}:promoted:${new Date().toISOString()}`)
    .digest('hex')
    .slice(0, 16);

  // Update candidate status
  db.prepare('UPDATE freeze_candidates SET status = ? WHERE id = ?').run('promoted', candidateId);

  // Create freeze receipt
  db.prepare(`
    INSERT INTO freeze_receipts (id, project_id, scope_type, scope_id,
      source_candidate_id, receipt_hash, freeze_summary, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    receiptId,
    projectId,
    candidate.scope_type,
    candidate.scope_id,
    candidateId,
    receiptHash,
    `Frozen ${candidate.scope_type}:${candidate.scope_id}`,
    overrideReason ? JSON.stringify({ override_reason: overrideReason }) : null,
  );

  // Emit state event
  db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    candidate.scope_type,
    candidate.scope_id,
    'candidate',
    'frozen',
    overrideReason ?? 'Freeze promoted',
    'proof_promote_freeze',
  );

  return db.prepare('SELECT * FROM freeze_receipts WHERE id = ?').get(receiptId) as FreezeReceiptRow;
}

export function revokeFreeze(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
  reason: string,
): void {
  // Create regression record
  const regId = `reg_${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO regressions (id, project_id, scope_type, scope_id, regression_type, severity, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(regId, projectId, scopeType, scopeId, 'freeze_revocation', 'critical', JSON.stringify({ reason }));

  // Update any promoted candidates to revoked
  db.prepare(`
    UPDATE freeze_candidates SET status = 'revoked'
    WHERE project_id = ? AND scope_type = ? AND scope_id = ? AND status = 'promoted'
  `).run(projectId, scopeType, scopeId);

  // Emit state event
  db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(projectId, scopeType, scopeId, 'frozen', 'revoked', reason, 'proof_revoke_freeze');
}
