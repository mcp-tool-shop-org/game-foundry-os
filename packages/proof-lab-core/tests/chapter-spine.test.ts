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
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  runAssetSuite,
  runEncounterSuite,
  runRuntimeSuite,
  createProofRun,
  addAssertion,
  getAssertions,
} from '@mcptoolshop/proof-lab-core';

let db: Database.Database;
let tmpDir: string;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', tmpDir);
}

function seedVariant(
  charId: string,
  varId: string,
  chapter: string,
  opts?: { packPresent?: number; dirsPresent?: number; prodState?: string; packName?: string },
) {
  upsertCharacter(db, { id: charId, project_id: 'test', display_name: `Char ${charId}` });
  db.prepare('UPDATE characters SET chapter_primary = ? WHERE id = ?').run(chapter, charId);
  upsertVariant(db, { id: varId, character_id: charId, variant_type: 'base' });

  const sets: string[] = [];
  if (opts?.packPresent !== undefined) sets.push(`pack_present = ${opts.packPresent}`);
  if (opts?.dirsPresent !== undefined) sets.push(`directions_present = ${opts.dirsPresent}`);
  if (opts?.prodState) sets.push(`production_state = '${opts.prodState}'`);
  if (opts?.packName) sets.push(`canonical_pack_name = '${opts.packName}'`);
  if (sets.length > 0) {
    db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(varId);
  }
}

function seedEncounter(id: string, chapter: string) {
  upsertEncounter(db, { id, project_id: 'test', chapter, label: `Encounter ${id}`, grid_rows: 3, grid_cols: 8 });
  db.prepare("UPDATE encounters SET display_name = ?, encounter_type = 'standard' WHERE id = ?").run(`Encounter ${id}`, id);
}

function insertValidationRun(encounterId: string, validationType: string, result: string) {
  db.prepare(`INSERT INTO encounter_validation_runs (encounter_id, validation_type, result) VALUES (?, ?, ?)`).run(encounterId, validationType, result);
}

function insertExport(encounterId: string) {
  db.prepare(`INSERT INTO encounter_exports (id, encounter_id, project_id, manifest_path, is_canonical) VALUES (?, ?, 'test', '/tmp/m.json', 1)`).run(`exp_${encounterId}`, encounterId);
}

function insertSyncReceipt(encounterId: string) {
  db.prepare(`INSERT INTO encounter_sync_receipts (id, encounter_id, project_id, target_path) VALUES (?, ?, 'test', '/tmp/r')`).run(`sync_${encounterId}`, encounterId);
}

function makePackDir(packName: string, variantName: string, fileCount: number) {
  const dir = path.join(tmpDir, 'assets', 'sprites', packName, variantName);
  fs.mkdirSync(dir, { recursive: true });
  const names = ['front', 'back', 'left', 'right', 'fl', 'fr', 'bl', 'br', 'e1', 'e2'];
  for (let i = 0; i < fileCount; i++) {
    fs.writeFileSync(path.join(dir, `${names[i] ?? `d${i}`}.png`), '');
  }
}

/** Replicate chapter spine logic from proofRunChapterSpine.ts */
function runChapterSpine(projectId: string, chapterId: string) {
  const assetResult = runAssetSuite(db, projectId, 'chapter', chapterId);
  const encounterResult = runEncounterSuite(db, projectId, 'chapter', chapterId);
  const runtimeResult = runRuntimeSuite(db, projectId, 'chapter', chapterId, tmpDir);

  const allPassed = assetResult.passed && encounterResult.passed && runtimeResult.passed;
  const totalFailures = assetResult.run.blocking_failures + encounterResult.run.blocking_failures + runtimeResult.run.blocking_failures;
  const totalWarnings = assetResult.run.warning_count + encounterResult.run.warning_count + runtimeResult.run.warning_count;

  // Count variants and encounters
  const variantCount = (db.prepare(`
    SELECT COUNT(*) as cnt FROM variants v JOIN characters c ON v.character_id = c.id
    WHERE c.project_id = ? AND c.chapter_primary = ?
  `).get(projectId, chapterId) as { cnt: number }).cnt;

  const encounterCount = (db.prepare(`
    SELECT COUNT(*) as cnt FROM encounters WHERE project_id = ? AND chapter = ?
  `).get(projectId, chapterId) as { cnt: number }).cnt;

  const run = createProofRun(db, {
    project_id: projectId,
    scope_type: 'chapter',
    scope_id: chapterId,
    result: allPassed ? 'pass' : 'fail',
    blocking_failures: totalFailures,
    warning_count: totalWarnings,
    summary: `Chapter spine: ${allPassed ? 'PASS' : 'FAIL'} (asset=${assetResult.run.result}, encounter=${encounterResult.run.result}, runtime=${runtimeResult.run.result})`,
    details_json: JSON.stringify({ variant_count: variantCount, encounter_count: encounterCount }),
    tool_name: 'proof_run_chapter_spine',
  });

  addAssertion(db, run.id, 'asset_suite', assetResult.passed ? 'pass' : 'fail', `Asset: ${assetResult.run.result}`);
  addAssertion(db, run.id, 'encounter_suite', encounterResult.passed ? 'pass' : 'fail', `Encounter: ${encounterResult.run.result}`);
  addAssertion(db, run.id, 'runtime_suite', runtimeResult.passed ? 'pass' : 'fail', `Runtime: ${runtimeResult.run.result}`);

  return { run, allPassed, assetResult, encounterResult, runtimeResult, variantCount, encounterCount };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-spine-'));
  seedProject();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('chapter spine proof', () => {
  it('aggregates asset + encounter + runtime results', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pk1' });
    seedEncounter('enc1', 'ch1');
    insertValidationRun('enc1', 'structural', 'pass');
    insertValidationRun('enc1', 'dependencies', 'pass');
    makePackDir('pk1', 'base', 8);

    const result = runChapterSpine('test', 'ch1');
    const assertions = getAssertions(db, result.run.id);
    const keys = assertions.map(a => a.assertion_key);
    expect(keys).toContain('asset_suite');
    expect(keys).toContain('encounter_suite');
    expect(keys).toContain('runtime_suite');
  });

  it('fails if any blocking sub-suite fails', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 0, dirsPresent: 3, prodState: 'draft', packName: 'pk1' });
    seedEncounter('enc1', 'ch1');
    // No validations, no pack dir — everything fails

    const result = runChapterSpine('test', 'ch1');
    expect(result.allPassed).toBe(false);
    expect(result.run.result).toBe('fail');
    expect(result.run.blocking_failures).toBeGreaterThan(0);
  });

  it('passes when all sub-suites pass', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pk1' });
    seedEncounter('enc1', 'ch1');
    insertValidationRun('enc1', 'structural', 'pass');
    insertValidationRun('enc1', 'dependencies', 'pass');
    insertExport('enc1');
    insertSyncReceipt('enc1');
    makePackDir('pk1', 'base', 8);

    const result = runChapterSpine('test', 'ch1');
    expect(result.allPassed).toBe(true);
    expect(result.run.result).toBe('pass');
  });

  it('records chapter-scope proof run with summary', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pk1' });
    makePackDir('pk1', 'base', 8);

    const result = runChapterSpine('test', 'ch1');
    expect(result.run.scope_type).toBe('chapter');
    expect(result.run.scope_id).toBe('ch1');
    expect(result.run.summary).toContain('Chapter spine');
    expect(result.run.tool_name).toBe('proof_run_chapter_spine');
  });

  it('includes encounter count and variant count in details', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pk1' });
    seedVariant('c2', 'v2', 'ch1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced', packName: 'pk2' });
    seedEncounter('enc1', 'ch1');
    seedEncounter('enc2', 'ch1');
    makePackDir('pk1', 'base', 8);
    makePackDir('pk2', 'base', 8);

    const result = runChapterSpine('test', 'ch1');
    expect(result.variantCount).toBe(2);
    expect(result.encounterCount).toBe(2);
    const details = JSON.parse(result.run.details_json!);
    expect(details.variant_count).toBe(2);
    expect(details.encounter_count).toBe(2);
  });
});
