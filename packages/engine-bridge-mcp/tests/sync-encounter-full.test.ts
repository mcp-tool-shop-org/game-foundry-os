import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import { syncEncounterManifest } from '../../engine-bridge-mcp/dist/tools/syncEncounterManifests.js';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('syncEncounterManifest', () => {
  let db: Database.Database;
  let tmpDir: string;
  const projectId = 'proj_sem';
  const encounterId = 'enc_full';

  beforeEach(() => {
    db = openDatabase(':memory:');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-sem-'));
    upsertProject(db, projectId, 'SEM Project', tmpDir);
    upsertEncounter(db, {
      id: encounterId,
      project_id: projectId,
      chapter: 'ch1',
      label: 'Test Battle',
      doctrine: 'ambush',
      max_turns: 10,
      grid_rows: 3,
      grid_cols: 8,
    });
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'Goblin Scout',
      variant_id: 'goblin_scout_base',
      sprite_pack: 'goblin_pack',
      ai_role: 'flanker',
      grid_row: 0,
      grid_col: 2,
      hp: 30,
      guard: 5,
      speed: 8,
      move_range: 3,
      engine_data: { loot_table: 'common' },
    });
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'Goblin Brute',
      variant_id: 'goblin_brute_base',
      sprite_pack: 'goblin_pack',
      ai_role: 'tank',
      grid_row: 1,
      grid_col: 4,
      hp: 60,
      guard: 15,
      speed: 4,
      move_range: 2,
      engine_data: { loot_table: 'rare', enrage_threshold: 0.3 },
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates output directory and writes JSON file', () => {
    const result = syncEncounterManifest(db, projectId, encounterId);
    expect(result.exported_path).toBeDefined();
    expect(fs.existsSync(result.exported_path)).toBe(true);

    const outDir = path.join(tmpDir, 'assets', 'data', 'encounters');
    expect(fs.existsSync(outDir)).toBe(true);
  });

  it('manifest contains correct encounter structure with enemies', () => {
    const result = syncEncounterManifest(db, projectId, encounterId);
    const manifest = JSON.parse(fs.readFileSync(result.exported_path, 'utf-8'));

    expect(manifest.encounter_id).toBe(encounterId);
    expect(manifest.chapter).toBe('ch1');
    expect(manifest.label).toBe('Test Battle');
    expect(manifest.doctrine).toBe('ambush');
    expect(manifest.max_turns).toBe(10);
    expect(manifest.grid).toEqual({ rows: 3, cols: 8 });
    expect(manifest.enemies).toHaveLength(2);
    expect(result.enemy_count).toBe(2);
  });

  it('enemy engine_data is parsed from JSON string to object', () => {
    const result = syncEncounterManifest(db, projectId, encounterId);
    const manifest = JSON.parse(fs.readFileSync(result.exported_path, 'utf-8'));

    const brute = manifest.enemies.find((e: any) => e.name === 'Goblin Brute');
    expect(brute).toBeDefined();
    expect(brute.engine_data).toEqual({ loot_table: 'rare', enrage_threshold: 0.3 });
    expect(typeof brute.engine_data).toBe('object');
  });

  it('throws for nonexistent encounter_id', () => {
    expect(() =>
      syncEncounterManifest(db, projectId, 'nonexistent_encounter'),
    ).toThrow(/Encounter not found/);
  });
});
