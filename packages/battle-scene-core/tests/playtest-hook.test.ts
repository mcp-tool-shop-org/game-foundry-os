import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract,
  startPlaytest,
  recordPlaytestFailures,
  completePlaytest,
  abandonPlaytest,
  getLatestPlaytest,
  computePlaytestReadability,
} from '@mcptoolshop/battle-scene-core';
import type { ReadFailureEntry } from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;

function seed() {
  upsertProject(db, 'proj-pt', 'Playtest Project', '/tmp/pt');
  upsertEncounter(db, { id: 'enc-pt', project_id: 'proj-pt', chapter: 'ch1', label: 'Playtest', grid_rows: 3, grid_cols: 8 });
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('startPlaytest', () => {
  it('creates a session in started state', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');

    expect(session.id).toMatch(/^pt_/);
    expect(session.session_state).toBe('started');
    expect(session.read_failures).toBe(0);
    expect(session.quality_verdict).toBeNull();
  });

  it('links to scene contract if one exists', () => {
    seed();
    const contract = createSceneContract(db, 'proj-pt', 'enc-pt');
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');

    expect(session.contract_id).toBe(contract.id);
  });
});

describe('recordPlaytestFailures', () => {
  it('records read failures and updates count', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    const failures: ReadFailureEntry[] = [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'Guard lost against background' },
      { snapshot_key: 'threat_on', failure_type: 'threat_ambiguous', description: 'Could not tell safe tiles' },
    ];

    const updated = recordPlaytestFailures(db, session.id, failures);
    expect(updated.read_failures).toBe(2);
    expect(updated.session_state).toBe('capturing');

    const parsed = JSON.parse(updated.failures_json!);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].failure_type).toBe('unit_invisible');
  });

  it('appends to existing failures', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    recordPlaytestFailures(db, session.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'First' },
    ]);
    const updated = recordPlaytestFailures(db, session.id, [
      { snapshot_key: 'forecast', failure_type: 'forecast_missing', description: 'Second' },
    ]);

    expect(updated.read_failures).toBe(2);
  });

  it('rejects recording on completed session', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    completePlaytest(db, session.id, 'pass');

    expect(() => recordPlaytestFailures(db, session.id, [])).toThrow('completed');
  });
});

describe('completePlaytest', () => {
  it('sets verdict and completed state', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    const completed = completePlaytest(db, session.id, 'marginal', 'HUD overlap needs work');

    expect(completed.session_state).toBe('completed');
    expect(completed.quality_verdict).toBe('marginal');
    expect(completed.notes).toBe('HUD overlap needs work');
    expect(completed.completed_at).toBeTruthy();
  });

  it('rejects double completion', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    completePlaytest(db, session.id, 'pass');

    expect(() => completePlaytest(db, session.id, 'fail')).toThrow('already completed');
  });
});

describe('computePlaytestReadability', () => {
  it('returns untested for encounter with no sessions', () => {
    seed();
    const score = computePlaytestReadability(db, 'enc-pt');

    expect(score.readability).toBe('untested');
    expect(score.total_sessions).toBe(0);
  });

  it('returns good for passing playtest with no failures', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    completePlaytest(db, session.id, 'pass');

    const score = computePlaytestReadability(db, 'enc-pt');
    expect(score.readability).toBe('good');
    expect(score.latest_verdict).toBe('pass');
  });

  it('returns poor for failing playtest', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    recordPlaytestFailures(db, session.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'Bad' },
    ]);
    completePlaytest(db, session.id, 'fail');

    const score = computePlaytestReadability(db, 'enc-pt');
    expect(score.readability).toBe('poor');
    expect(score.total_read_failures).toBe(1);
  });

  it('returns marginal for many failures even with pass verdict', () => {
    seed();
    const session = startPlaytest(db, 'proj-pt', 'enc-pt');
    recordPlaytestFailures(db, session.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: '1' },
      { snapshot_key: 'threat_on', failure_type: 'threat_ambiguous', description: '2' },
      { snapshot_key: 'forecast', failure_type: 'forecast_missing', description: '3' },
      { snapshot_key: 'enemy_turn', failure_type: 'intent_unclear', description: '4' },
    ]);
    completePlaytest(db, session.id, 'pass');

    const score = computePlaytestReadability(db, 'enc-pt');
    expect(score.readability).toBe('marginal');
    expect(score.failure_breakdown['unit_invisible']).toBe(1);
    expect(score.failure_breakdown['threat_ambiguous']).toBe(1);
  });
});
