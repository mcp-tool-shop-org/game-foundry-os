import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
} from '@mcptoolshop/game-foundry-registry';
import {
  runAssetSuite,
  createProofRun,
  getFreezeReadiness,
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

function createBlockingSuite(suiteKey: string, scopeType: string) {
  const id = `suite_${suiteKey}_${scopeType}`;
  db.prepare(`
    INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
    VALUES (?, 'test', ?, ?, ?, 1)
  `).run(id, suiteKey, scopeType, `${suiteKey} (${scopeType})`);
  return id;
}

function createNonBlockingSuite(suiteKey: string, scopeType: string) {
  const id = `suite_${suiteKey}_${scopeType}`;
  db.prepare(`
    INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
    VALUES (?, 'test', ?, ?, ?, 0)
  `).run(id, suiteKey, scopeType, `${suiteKey} (${scopeType})`);
  return id;
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('freeze policy evaluation', () => {
  it('blocking policy prevents readiness when suite fails', () => {
    seedVariant('v1', { packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    // Running asset suite auto-creates a blocking suite and records a fail
    runAssetSuite(db, 'test', 'variant', 'v1');

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'v1');
    expect(readiness.readiness).toBe('blocked');
    expect(readiness.blocking_reasons.length).toBeGreaterThan(0);
    expect(readiness.blocking_reasons[0]).toContain('failed');
  });

  it('non-blocking policy allows warning_only readiness', () => {
    // Create only a non-blocking suite with a failed run
    const suiteId = createNonBlockingSuite('presentation', 'variant');
    createProofRun(db, {
      project_id: 'test',
      suite_id: suiteId,
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'fail',
      blocking_failures: 1,
      warning_count: 0,
    });

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'v1');
    expect(readiness.readiness).toBe('warning_only');
    expect(readiness.warning_reasons.length).toBeGreaterThan(0);
  });

  it('multiple policies evaluated together', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    // Run asset suite (blocking) — passes
    runAssetSuite(db, 'test', 'variant', 'v1');

    // Create another blocking suite with a fail
    const suiteId = createBlockingSuite('encounter', 'variant');
    createProofRun(db, {
      project_id: 'test',
      suite_id: suiteId,
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'fail',
      blocking_failures: 2,
      warning_count: 0,
    });

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'v1');
    expect(readiness.readiness).toBe('blocked');
    // Should mention the encounter suite failure
    expect(readiness.blocking_reasons.some(r => r.includes('encounter'))).toBe(true);
  });

  it('missing required suite blocks readiness', () => {
    // Create a blocking suite with no runs at all
    createBlockingSuite('runtime', 'variant');

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'v1');
    expect(readiness.readiness).toBe('blocked');
    expect(readiness.blocking_reasons.some(r => r.includes('never run'))).toBe(true);
  });

  it('all policies met returns ready', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    // Run asset suite — passes (auto-creates blocking suite)
    runAssetSuite(db, 'test', 'variant', 'v1');

    // Create another blocking suite that passes
    const suiteId = createBlockingSuite('encounter', 'variant');
    createProofRun(db, {
      project_id: 'test',
      suite_id: suiteId,
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'pass',
      blocking_failures: 0,
      warning_count: 0,
    });

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'v1');
    expect(readiness.readiness).toBe('ready');
    expect(readiness.blocking_reasons).toHaveLength(0);
  });
});
