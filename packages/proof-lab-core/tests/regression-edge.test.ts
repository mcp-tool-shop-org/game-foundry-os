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
  listRegressions,
  createFreezeCandidate,
  promoteFreeze,
  revokeFreeze,
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

describe('regression edge cases', () => {
  it('no regression when latest run is the first run', () => {
    createProofRun(db, {
      project_id: 'test',
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'fail',
      blocking_failures: 1,
      warning_count: 0,
    });

    const result = detectRegressions(db, 'test', 'variant', 'v1');
    expect(result.regressions_found).toBe(0);
    expect(result.new_regressions).toHaveLength(0);
  });

  it('regression severity is critical by default', () => {
    createProofRun(db, {
      project_id: 'test',
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'pass',
      blocking_failures: 0,
      warning_count: 0,
    });
    createProofRun(db, {
      project_id: 'test',
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'fail',
      blocking_failures: 3,
      warning_count: 0,
    });

    const result = detectRegressions(db, 'test', 'variant', 'v1');
    expect(result.regressions_found).toBe(1);
    expect(result.new_regressions[0].severity).toBe('critical');
    expect(result.new_regressions[0].regression_type).toBe('proof_regression');
  });

  it('listRegressions filters by scope_type', () => {
    // Create regressions for variant scope
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    detectRegressions(db, 'test', 'variant', 'v1');

    // Create regressions for chapter scope
    createProofRun(db, { project_id: 'test', scope_type: 'chapter', scope_id: 'ch1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'chapter', scope_id: 'ch1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    detectRegressions(db, 'test', 'chapter', 'ch1');

    const variantRegs = listRegressions(db, 'test', 'variant');
    const chapterRegs = listRegressions(db, 'test', 'chapter');
    const allRegs = listRegressions(db, 'test');

    expect(variantRegs).toHaveLength(1);
    expect(chapterRegs).toHaveLength(1);
    expect(allRegs).toHaveLength(2);
  });

  it('regression after freeze triggers correct type', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    // Pass → freeze → revoke (creates freeze_revocation regression)
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    promoteFreeze(db, 'test', candidate.id);
    revokeFreeze(db, 'test', 'variant', 'v1', 'Pack corrupted');

    const regs = listRegressions(db, 'test', 'variant', 'v1');
    expect(regs.some(r => r.regression_type === 'freeze_revocation')).toBe(true);
    expect(regs.some(r => r.severity === 'critical')).toBe(true);
  });
});
