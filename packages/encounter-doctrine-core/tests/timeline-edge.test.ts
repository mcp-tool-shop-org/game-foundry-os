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
  getEncounterTimeline,
  getChapterMatrix,
} from '@mcptoolshop/encounter-doctrine-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-tl-'));
  upsertProject(db, 'test', 'Test', tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('timeline edge cases', () => {
  it('empty encounter returns empty timeline', () => {
    upsertEncounter(db, { id: 'enc_empty', project_id: 'test', chapter: 'ch1', label: 'Empty', grid_rows: 3, grid_cols: 8 });
    const timeline = getEncounterTimeline(db, 'enc_empty');
    expect(timeline).toHaveLength(0);
  });

  it('timeline includes validation runs with pass/fail details', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Goblin',
      variant_id: 'v1',
      sprite_pack: 'p1',
      grid_row: 0,
      grid_col: 0,
    });

    validateStructural(db, 'enc1');

    const timeline = getEncounterTimeline(db, 'enc1');
    const validationEntries = timeline.filter(e => e.type === 'validation');
    expect(validationEntries.length).toBeGreaterThanOrEqual(1);
    expect(validationEntries[0].summary).toContain('structural');
  });

  it('timeline entries are sorted by timestamp', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle', encounter_type = 'standard' WHERE id = 'enc1'").run();

    upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char' });
    upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
    upsertPack(db, { id: 'pack1', project_id: 'test', pack_type: 'enemy', root_path: '/tmp' });

    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Goblin',
      variant_id: 'var1',
      sprite_pack: 'pack1',
      grid_row: 0,
      grid_col: 0,
    });

    transitionEncounterState(db, 'enc1', 'intent_defined');
    validateStructural(db, 'enc1');
    validateDependencies(db, 'enc1');
    exportManifest(db, 'enc1', tmpDir, 'enc1.json');

    const timeline = getEncounterTimeline(db, 'enc1');
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    // Check chronological order
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestamp >= timeline[i - 1].timestamp).toBe(true);
    }
  });

  it('getChapterMatrix returns empty array for chapter with no encounters', () => {
    const matrix = getChapterMatrix(db, 'test', 'nonexistent_chapter');
    expect(matrix).toHaveLength(0);
    expect(Array.isArray(matrix)).toBe(true);
  });
});
