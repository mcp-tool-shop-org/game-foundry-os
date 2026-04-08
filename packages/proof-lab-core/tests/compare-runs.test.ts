import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
} from '@mcptoolshop/game-foundry-registry';
import {
  createProofRun,
  addAssertion,
  getProofRun,
  getAssertions,
} from '@mcptoolshop/proof-lab-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

/**
 * Compare two proof runs by diffing their assertions.
 * Replicates the logic from proofCompareRuns.ts.
 */
function compareRuns(runIdA: string, runIdB: string) {
  const runA = getProofRun(db, runIdA);
  const runB = getProofRun(db, runIdB);
  if (!runA || !runB) return { error: 'One or both runs not found' };

  const assertionsA = getAssertions(db, runIdA);
  const assertionsB = getAssertions(db, runIdB);

  const mapA = new Map(assertionsA.map(a => [a.assertion_key, a]));
  const mapB = new Map(assertionsB.map(a => [a.assertion_key, a]));
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

  const diffs: Array<{
    key: string;
    status_a: string | null;
    status_b: string | null;
    changed: boolean;
  }> = [];

  for (const key of allKeys) {
    const a = mapA.get(key);
    const b = mapB.get(key);
    diffs.push({
      key,
      status_a: a?.status ?? null,
      status_b: b?.status ?? null,
      changed: (a?.status ?? null) !== (b?.status ?? null),
    });
  }

  return {
    run_a: { id: runA.id, result: runA.result },
    run_b: { id: runB.id, result: runB.result },
    total_assertions: allKeys.size,
    changed: diffs.filter(d => d.changed).length,
    diffs,
  };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('compare proof runs', () => {
  it('diffs two runs and identifies new failures', () => {
    const runA = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    addAssertion(db, runA.id, 'pack_present', 'pass', 'OK');
    addAssertion(db, runA.id, 'dirs_complete', 'pass', 'OK');

    const runB = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    addAssertion(db, runB.id, 'pack_present', 'pass', 'OK');
    addAssertion(db, runB.id, 'dirs_complete', 'fail', 'Only 5/8');

    const result = compareRuns(runA.id, runB.id);
    expect(result.changed).toBe(1);
    const changedDiff = result.diffs!.find(d => d.changed);
    expect(changedDiff!.key).toBe('dirs_complete');
    expect(changedDiff!.status_a).toBe('pass');
    expect(changedDiff!.status_b).toBe('fail');
  });

  it('diffs two runs and identifies fixed assertions', () => {
    const runA = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    addAssertion(db, runA.id, 'pack_present', 'fail', 'Missing');
    addAssertion(db, runA.id, 'dirs_complete', 'pass', 'OK');

    const runB = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    addAssertion(db, runB.id, 'pack_present', 'pass', 'Found');
    addAssertion(db, runB.id, 'dirs_complete', 'pass', 'OK');

    const result = compareRuns(runA.id, runB.id);
    expect(result.changed).toBe(1);
    const fixedDiff = result.diffs!.find(d => d.changed);
    expect(fixedDiff!.key).toBe('pack_present');
    expect(fixedDiff!.status_a).toBe('fail');
    expect(fixedDiff!.status_b).toBe('pass');
  });

  it('returns empty diff for identical runs', () => {
    const runA = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    addAssertion(db, runA.id, 'pack_present', 'pass', 'OK');
    addAssertion(db, runA.id, 'dirs_complete', 'pass', 'OK');

    const runB = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    addAssertion(db, runB.id, 'pack_present', 'pass', 'OK');
    addAssertion(db, runB.id, 'dirs_complete', 'pass', 'OK');

    const result = compareRuns(runA.id, runB.id);
    expect(result.changed).toBe(0);
    expect(result.total_assertions).toBe(2);
    expect(result.diffs!.every(d => !d.changed)).toBe(true);
  });
});
