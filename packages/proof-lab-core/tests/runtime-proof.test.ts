import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
} from '@mcptoolshop/game-foundry-registry';
import { runRuntimeSuite, getAssertions } from '@mcptoolshop/proof-lab-core';

let db: Database.Database;
let tmpDir: string;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', tmpDir);
}

function seedVariant(
  charId: string,
  varId: string,
  chapter: string,
  opts?: { packPresent?: number; dirsPresent?: number; prodState?: string; packName?: string; variantType?: string },
) {
  upsertCharacter(db, { id: charId, project_id: 'test', display_name: `Char ${charId}` });
  db.prepare('UPDATE characters SET chapter_primary = ? WHERE id = ?').run(chapter, charId);
  upsertVariant(db, { id: varId, character_id: charId, variant_type: opts?.variantType ?? 'base' });

  const sets: string[] = [];
  if (opts?.packPresent !== undefined) sets.push(`pack_present = ${opts.packPresent}`);
  if (opts?.dirsPresent !== undefined) sets.push(`directions_present = ${opts.dirsPresent}`);
  if (opts?.prodState) sets.push(`production_state = '${opts.prodState}'`);
  if (opts?.packName) sets.push(`canonical_pack_name = '${opts.packName}'`);
  if (sets.length > 0) {
    db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(varId);
  }
}

function makePackDir(packName: string, variantName: string, fileCount: number) {
  const dir = path.join(tmpDir, 'assets', 'sprites', packName, variantName);
  fs.mkdirSync(dir, { recursive: true });
  const dirNames = ['front', 'back', 'left', 'right', 'front_left', 'front_right', 'back_left', 'back_right', 'extra1', 'extra2'];
  for (let i = 0; i < fileCount; i++) {
    fs.writeFileSync(path.join(dir, `${dirNames[i] ?? `dir${i}`}.png`), '');
  }
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-runtime-'));
  seedProject();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runtime proof suite', () => {
  it('passes when all variants have pack dirs with 8 PNGs on disk', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pack_a' });
    // runtime-proof uses canonical_pack_name || character_id and runtime_variant_name || variant_type
    makePackDir('pack_a', 'base', 8);

    const result = runRuntimeSuite(db, 'test', 'variant', 'v1', tmpDir);
    expect(result.passed).toBe(true);
    expect(result.run.result).toBe('pass');
  });

  it('fails when a variant pack dir is missing', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pack_missing' });
    // Don't create the directory

    const result = runRuntimeSuite(db, 'test', 'variant', 'v1', tmpDir);
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'v1_dir_exists' && a.status === 'fail')).toBe(true);
  });

  it('fails when variant has fewer than 8 direction PNGs', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pack_b' });
    makePackDir('pack_b', 'base', 4);

    const result = runRuntimeSuite(db, 'test', 'variant', 'v1', tmpDir);
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'v1_dir_files' && a.status === 'fail')).toBe(true);
  });

  it('creates assertions for each variant checked', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pack_c' });
    makePackDir('pack_c', 'base', 8);

    const result = runRuntimeSuite(db, 'test', 'variant', 'v1', tmpDir);
    expect(result.assertions.length).toBeGreaterThanOrEqual(2);

    const stored = getAssertions(db, result.run.id);
    expect(stored.length).toBeGreaterThanOrEqual(2);
  });

  it('chapter scope checks all variants in chapter', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pk1' });
    seedVariant('c2', 'v2', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pk2' });
    makePackDir('pk1', 'base', 8);
    makePackDir('pk2', 'base', 8);

    const result = runRuntimeSuite(db, 'test', 'chapter', 'ch1', tmpDir);
    expect(result.passed).toBe(true);
    // Should have assertions for both variants
    const v1Assertions = result.assertions.filter(a => a.key.startsWith('v1'));
    const v2Assertions = result.assertions.filter(a => a.key.startsWith('v2'));
    expect(v1Assertions.length).toBeGreaterThan(0);
    expect(v2Assertions.length).toBeGreaterThan(0);
  });
});
