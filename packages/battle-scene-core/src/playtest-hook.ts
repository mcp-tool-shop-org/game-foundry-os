import type Database from 'better-sqlite3';
import type {
  PlaytestSessionRow,
  PlaytestVerdict,
  ReadFailureEntry,
  BattleSnapshotKey,
  ReadFailureType,
} from '@mcptoolshop/game-foundry-registry';
import {
  insertPlaytestSession,
  updatePlaytestSession,
  getPlaytestSession,
  listPlaytestSessions,
  getSceneContractByEncounter,
} from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

/**
 * Start a playtest session for an encounter.
 */
export function startPlaytest(
  db: Database.Database,
  projectId: string,
  encounterId: string,
): PlaytestSessionRow {
  const contract = getSceneContractByEncounter(db, encounterId);
  const id = `pt_${crypto.randomUUID().slice(0, 12)}`;

  return insertPlaytestSession(db, {
    id,
    project_id: projectId,
    encounter_id: encounterId,
    contract_id: contract?.id,
  });
}

/**
 * Record read failures during a playtest.
 */
export function recordPlaytestFailures(
  db: Database.Database,
  sessionId: string,
  failures: ReadFailureEntry[],
): PlaytestSessionRow {
  const session = getPlaytestSession(db, sessionId);
  if (!session) throw new Error(`Playtest session not found: ${sessionId}`);
  if (session.session_state === 'completed' || session.session_state === 'abandoned') {
    throw new Error(`Cannot modify ${session.session_state} session`);
  }

  const existing: ReadFailureEntry[] = session.failures_json ? JSON.parse(session.failures_json) : [];
  const allFailures = [...existing, ...failures];

  return updatePlaytestSession(db, sessionId, {
    session_state: 'capturing',
    read_failures: allFailures.length,
    failures_json: JSON.stringify(allFailures),
  });
}

/**
 * Complete a playtest session with a quality verdict.
 */
export function completePlaytest(
  db: Database.Database,
  sessionId: string,
  verdict: PlaytestVerdict,
  notes?: string,
): PlaytestSessionRow {
  const session = getPlaytestSession(db, sessionId);
  if (!session) throw new Error(`Playtest session not found: ${sessionId}`);
  if (session.session_state === 'completed') {
    throw new Error('Session already completed');
  }

  return updatePlaytestSession(db, sessionId, {
    session_state: 'completed',
    quality_verdict: verdict,
    notes: notes ?? undefined,
    completed_at: new Date().toISOString(),
  });
}

/**
 * Abandon a playtest session.
 */
export function abandonPlaytest(
  db: Database.Database,
  sessionId: string,
): PlaytestSessionRow {
  return updatePlaytestSession(db, sessionId, {
    session_state: 'abandoned',
    completed_at: new Date().toISOString(),
  });
}

/**
 * Get the latest playtest session for an encounter.
 */
export function getLatestPlaytest(
  db: Database.Database,
  encounterId: string,
): PlaytestSessionRow | undefined {
  const sessions = listPlaytestSessions(db, encounterId);
  return sessions[0]; // already ordered by started_at DESC
}

/**
 * Compute a playtest readability score from failures.
 */
export interface PlaytestReadabilityScore {
  encounter_id: string;
  total_sessions: number;
  latest_verdict: PlaytestVerdict | null;
  total_read_failures: number;
  failure_breakdown: Record<string, number>;
  readability: 'good' | 'marginal' | 'poor' | 'untested';
}

export function computePlaytestReadability(
  db: Database.Database,
  encounterId: string,
): PlaytestReadabilityScore {
  const sessions = listPlaytestSessions(db, encounterId);
  const completed = sessions.filter(s => s.session_state === 'completed');

  if (completed.length === 0) {
    return {
      encounter_id: encounterId,
      total_sessions: 0,
      latest_verdict: null,
      total_read_failures: 0,
      failure_breakdown: {},
      readability: 'untested',
    };
  }

  const latest = completed[0];
  let totalFailures = 0;
  const breakdown: Record<string, number> = {};

  for (const session of completed) {
    totalFailures += session.read_failures;
    if (session.failures_json) {
      const failures: ReadFailureEntry[] = JSON.parse(session.failures_json);
      for (const f of failures) {
        breakdown[f.failure_type] = (breakdown[f.failure_type] ?? 0) + 1;
      }
    }
  }

  let readability: 'good' | 'marginal' | 'poor' = 'good';
  if (latest.quality_verdict === 'fail') readability = 'poor';
  else if (latest.quality_verdict === 'marginal' || totalFailures > 3) readability = 'marginal';

  return {
    encounter_id: encounterId,
    total_sessions: completed.length,
    latest_verdict: latest.quality_verdict as PlaytestVerdict | null,
    total_read_failures: totalFailures,
    failure_breakdown: breakdown,
    readability,
  };
}
