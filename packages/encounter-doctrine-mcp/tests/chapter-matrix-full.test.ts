import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  transitionEncounterState,
  addUnit,
  validateStructural,
  validateDependencies,
  exportManifest,
  getChapterMatrix,
} from '@mcptoolshop/encounter-doctrine-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-cm-'));
  upsertProject(db, 'test', 'Test', tmpDir);
  upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char' });
  upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
  upsertPack(db, { id: 'pack1', project_id: 'test', pack_type: 'enemy', root_path: '/tmp' });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('chapter matrix', () => {
  it('returns all encounters for a chapter with production states', () => {
    upsertEncounter(db, { id: 'enc_a', project_id: 'test', chapter: 'ch1', label: 'Battle A', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle A', encounter_type = 'standard' WHERE id = 'enc_a'").run();
    upsertEncounter(db, { id: 'enc_b', project_id: 'test', chapter: 'ch1', label: 'Battle B', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle B', encounter_type = 'boss' WHERE id = 'enc_b'").run();

    transitionEncounterState(db, 'enc_b', 'intent_defined');

    const matrix = getChapterMatrix(db, 'test', 'ch1');
    expect(matrix).toHaveLength(2);

    const encA = matrix.find(e => e.encounter_id === 'enc_a');
    const encB = matrix.find(e => e.encounter_id === 'enc_b');
    expect(encA!.production_state).toBe('draft');
    expect(encB!.production_state).toBe('intent_defined');
    expect(encB!.encounter_type).toBe('boss');
  });

  it('includes validation status per encounter', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle', encounter_type = 'standard' WHERE id = 'enc1'").run();
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0 });

    validateStructural(db, 'enc1');
    validateDependencies(db, 'enc1');

    const matrix = getChapterMatrix(db, 'test', 'ch1');
    expect(matrix).toHaveLength(1);
    expect(matrix[0].bounds_valid).toBe(true);
    expect(matrix[0].formation_valid).toBe(true);
    expect(matrix[0].variants_valid).toBe(true);
  });

  it('filters by project_id', () => {
    upsertProject(db, 'other', 'Other', '/tmp/other');
    upsertEncounter(db, { id: 'enc_test', project_id: 'test', chapter: 'ch1', label: 'Test Battle', grid_rows: 3, grid_cols: 8 });
    upsertEncounter(db, { id: 'enc_other', project_id: 'other', chapter: 'ch1', label: 'Other Battle', grid_rows: 3, grid_cols: 8 });

    const testMatrix = getChapterMatrix(db, 'test', 'ch1');
    expect(testMatrix).toHaveLength(1);
    expect(testMatrix[0].encounter_id).toBe('enc_test');

    const otherMatrix = getChapterMatrix(db, 'other', 'ch1');
    expect(otherMatrix).toHaveLength(1);
    expect(otherMatrix[0].encounter_id).toBe('enc_other');
  });

  it('returns empty for nonexistent chapter', () => {
    const matrix = getChapterMatrix(db, 'test', 'ch_missing');
    expect(matrix).toHaveLength(0);
  });
});
