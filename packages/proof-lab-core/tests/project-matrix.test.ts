import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  runAssetSuite,
  createProofRun,
  createFreezeCandidate,
  promoteFreeze,
} from '@mcptoolshop/proof-lab-core';
import type { ProofRunRow, FreezeReceiptRow } from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function seedVariant(charId: string, varId: string, chapter: string, opts?: { packPresent?: number; dirsPresent?: number; prodState?: string }) {
  upsertCharacter(db, { id: charId, project_id: 'test', display_name: `Char ${charId}` });
  db.prepare('UPDATE characters SET chapter_primary = ? WHERE id = ?').run(chapter, charId);
  upsertVariant(db, { id: varId, character_id: charId, variant_type: 'base' });

  const sets: string[] = [];
  if (opts?.packPresent !== undefined) sets.push(`pack_present = ${opts.packPresent}`);
  if (opts?.dirsPresent !== undefined) sets.push(`directions_present = ${opts.dirsPresent}`);
  if (opts?.prodState) sets.push(`production_state = '${opts.prodState}'`);
  if (sets.length > 0) {
    db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(varId);
  }
}

function seedEncounter(id: string, chapter: string) {
  upsertEncounter(db, { id, project_id: 'test', chapter, label: `Encounter ${id}`, grid_rows: 3, grid_cols: 8 });
}

/**
 * Replicates proofGetProjectMatrix.ts logic.
 */
function getProjectMatrix(projectId: string) {
  const entries: Array<{
    scope_type: string;
    scope_id: string;
    latest_proof_result: string | null;
    freeze_status: string;
    blocking_failures: number;
    warning_count: number;
  }> = [];

  const variants = db.prepare(`
    SELECT v.id FROM variants v JOIN characters c ON v.character_id = c.id WHERE c.project_id = ?
  `).all(projectId) as Array<{ id: string }>;

  for (const v of variants) {
    const run = db.prepare(`SELECT * FROM proof_runs WHERE scope_type = 'variant' AND scope_id = ? ORDER BY created_at DESC LIMIT 1`).get(v.id) as ProofRunRow | undefined;
    const receipt = db.prepare(`SELECT * FROM freeze_receipts WHERE scope_type = 'variant' AND scope_id = ? ORDER BY created_at DESC LIMIT 1`).get(v.id) as FreezeReceiptRow | undefined;
    entries.push({
      scope_type: 'variant',
      scope_id: v.id,
      latest_proof_result: run?.result ?? null,
      freeze_status: receipt ? 'frozen' : 'unfrozen',
      blocking_failures: run?.blocking_failures ?? 0,
      warning_count: run?.warning_count ?? 0,
    });
  }

  const encounters = db.prepare(`SELECT id FROM encounters WHERE project_id = ?`).all(projectId) as Array<{ id: string }>;
  for (const enc of encounters) {
    const run = db.prepare(`SELECT * FROM proof_runs WHERE scope_type = 'encounter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1`).get(enc.id) as ProofRunRow | undefined;
    const receipt = db.prepare(`SELECT * FROM freeze_receipts WHERE scope_type = 'encounter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1`).get(enc.id) as FreezeReceiptRow | undefined;
    entries.push({
      scope_type: 'encounter',
      scope_id: enc.id,
      latest_proof_result: run?.result ?? null,
      freeze_status: receipt ? 'frozen' : 'unfrozen',
      blocking_failures: run?.blocking_failures ?? 0,
      warning_count: run?.warning_count ?? 0,
    });
  }

  const chapters = db.prepare(`SELECT DISTINCT chapter FROM encounters WHERE project_id = ?`).all(projectId) as Array<{ chapter: string }>;
  for (const ch of chapters) {
    const run = db.prepare(`SELECT * FROM proof_runs WHERE scope_type = 'chapter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1`).get(ch.chapter) as ProofRunRow | undefined;
    const receipt = db.prepare(`SELECT * FROM freeze_receipts WHERE scope_type = 'chapter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1`).get(ch.chapter) as FreezeReceiptRow | undefined;
    entries.push({
      scope_type: 'chapter',
      scope_id: ch.chapter,
      latest_proof_result: run?.result ?? null,
      freeze_status: receipt ? 'frozen' : 'unfrozen',
      blocking_failures: run?.blocking_failures ?? 0,
      warning_count: run?.warning_count ?? 0,
    });
  }

  return {
    entries,
    summary: {
      total: entries.length,
      proven: entries.filter(e => e.latest_proof_result === 'pass').length,
      failing: entries.filter(e => e.latest_proof_result === 'fail').length,
      unproven: entries.filter(e => e.latest_proof_result === null).length,
      frozen: entries.filter(e => e.freeze_status === 'frozen').length,
    },
  };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('project matrix', () => {
  it('returns all chapters with proof/freeze states', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    seedEncounter('enc1', 'ch1');
    runAssetSuite(db, 'test', 'variant', 'v1');

    const matrix = getProjectMatrix('test');
    expect(matrix.entries.some(e => e.scope_type === 'variant' && e.scope_id === 'v1')).toBe(true);
    expect(matrix.entries.some(e => e.scope_type === 'encounter' && e.scope_id === 'enc1')).toBe(true);
    expect(matrix.entries.some(e => e.scope_type === 'chapter' && e.scope_id === 'ch1')).toBe(true);
  });

  it('includes variant and encounter counts per chapter', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    seedVariant('c2', 'v2', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    seedEncounter('enc1', 'ch1');
    seedEncounter('enc2', 'ch1');

    const matrix = getProjectMatrix('test');
    const variantEntries = matrix.entries.filter(e => e.scope_type === 'variant');
    const encounterEntries = matrix.entries.filter(e => e.scope_type === 'encounter');
    expect(variantEntries).toHaveLength(2);
    expect(encounterEntries).toHaveLength(2);
  });

  it('shows freeze candidates and receipts', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    seedEncounter('enc1', 'ch1');
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    promoteFreeze(db, 'test', candidate.id);

    const matrix = getProjectMatrix('test');
    const v1Entry = matrix.entries.find(e => e.scope_type === 'variant' && e.scope_id === 'v1');
    expect(v1Entry!.freeze_status).toBe('frozen');
    expect(matrix.summary.frozen).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for project with no content', () => {
    const matrix = getProjectMatrix('test');
    expect(matrix.entries).toHaveLength(0);
    expect(matrix.summary.total).toBe(0);
    expect(matrix.summary.proven).toBe(0);
    expect(matrix.summary.frozen).toBe(0);
  });
});
