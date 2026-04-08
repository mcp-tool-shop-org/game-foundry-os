import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
} from '@mcptoolshop/game-foundry-registry';
import {
  createProofRun,
  runAssetSuite,
  detectRegressions,
  createFreezeCandidate,
  promoteFreeze,
  getProofTimeline,
} from '@mcptoolshop/proof-lab-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function seedVariant(varId: string, opts?: { packPresent?: number; dirsPresent?: number; prodState?: string }) {
  upsertCharacter(db, { id: `char_${varId}`, project_id: 'test', display_name: `Char ${varId}` });
  db.prepare('UPDATE characters SET chapter_primary = ? WHERE id = ?').run('ch1', `char_${varId}`);
  upsertVariant(db, { id: varId, character_id: `char_${varId}`, variant_type: 'base' });

  const sets: string[] = [];
  if (opts?.packPresent !== undefined) sets.push(`pack_present = ${opts.packPresent}`);
  if (opts?.dirsPresent !== undefined) sets.push(`directions_present = ${opts.dirsPresent}`);
  if (opts?.prodState) sets.push(`production_state = '${opts.prodState}'`);
  if (sets.length > 0) {
    db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(varId);
  }
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('proof timeline edge cases', () => {
  it('includes regressions in timeline', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    detectRegressions(db, 'test', 'variant', 'v1');

    const timeline = getProofTimeline(db, 'test', 'variant', 'v1');
    const types = timeline.map(t => t.type);
    expect(types).toContain('regression');
    const regEntry = timeline.find(t => t.type === 'regression');
    expect(regEntry!.summary).toContain('proof_regression');
  });

  it('includes freeze receipts in timeline', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    promoteFreeze(db, 'test', candidate.id);

    const timeline = getProofTimeline(db, 'test', 'variant', 'v1');
    const types = timeline.map(t => t.type);
    expect(types).toContain('freeze_receipt');
    expect(types).toContain('freeze_candidate');
    expect(types).toContain('state_event');
  });

  it('timeline sorted chronologically across event types', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    promoteFreeze(db, 'test', candidate.id);

    const timeline = getProofTimeline(db, 'test', 'variant', 'v1');
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    // Verify chronological order
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestamp >= timeline[i - 1].timestamp).toBe(true);
    }
  });
});
