import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, upsertProject, upsertEncounter, addEnemy,
  upsertCharacter, upsertVariant, upsertPack,
} from '@mcptoolshop/game-foundry-registry';
import { syncEncounterManifest } from '../src/tools/syncEncounterManifests.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-enc-'));
  upsertProject(db, 'test', 'Test', tmpDir);
  upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
  upsertCharacter(db, { id: 'goblin', project_id: 'test', display_name: 'Goblin', role: 'enemy' });
  upsertVariant(db, { id: 'grubblade', character_id: 'goblin', variant_type: 'base', pack_id: 'enemies' });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('syncEncounterManifest', () => {
  it('creates output directory and writes valid JSON file', () => {
    upsertEncounter(db, { id: 'fight1', project_id: 'test', chapter: 'ch1', label: 'Fight', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'fight1', display_name: 'Goblin', variant_id: 'grubblade', sprite_pack: 'enemies', grid_row: 1, grid_col: 5 });

    const result = syncEncounterManifest(db, 'test', 'fight1');
    expect(result.exported_path).toContain('fight1.json');
    expect(fs.existsSync(result.exported_path)).toBe(true);

    const content = JSON.parse(fs.readFileSync(result.exported_path, 'utf-8'));
    expect(content.encounter_id).toBe('fight1');
  });

  it('manifest contains correct encounter_id, chapter, label, grid, enemies', () => {
    upsertEncounter(db, { id: 'ambush', project_id: 'test', chapter: 'ch1', label: 'Raider Ambush', doctrine: 'opportunist', max_turns: 16, grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'ambush', display_name: 'Grubblade', variant_id: 'grubblade', sprite_pack: 'enemies', grid_row: 1, grid_col: 5, hp: 8, guard: 3, speed: 9, move_range: 3, ai_role: 'center_holder' });

    const result = syncEncounterManifest(db, 'test', 'ambush');
    const manifest = JSON.parse(fs.readFileSync(result.exported_path, 'utf-8'));

    expect(manifest.encounter_id).toBe('ambush');
    expect(manifest.chapter).toBe('ch1');
    expect(manifest.label).toBe('Raider Ambush');
    expect(manifest.doctrine).toBe('opportunist');
    expect(manifest.grid).toEqual({ rows: 3, cols: 8 });
    expect(manifest.enemies).toHaveLength(1);
    expect(manifest.enemies[0].name).toBe('Grubblade');
    expect(manifest.enemies[0].hp).toBe(8);
    expect(manifest.enemies[0].grid_pos).toEqual({ row: 1, col: 5 });
  });

  it('enemy entries include parsed engine_data as object, not string', () => {
    upsertEncounter(db, { id: 'boss', project_id: 'test', chapter: 'ch1', label: 'Boss', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, {
      encounter_id: 'boss', display_name: 'Avar', variant_id: 'grubblade', sprite_pack: 'enemies',
      grid_row: 1, grid_col: 6, hp: 18, engine_data: { phase: 1, transition_hp: 8 },
    });

    const result = syncEncounterManifest(db, 'test', 'boss');
    const manifest = JSON.parse(fs.readFileSync(result.exported_path, 'utf-8'));

    expect(typeof manifest.enemies[0].engine_data).toBe('object');
    expect(manifest.enemies[0].engine_data.phase).toBe(1);
    expect(manifest.enemies[0].engine_data.transition_hp).toBe(8);
  });

  it('throws for nonexistent project_id', () => {
    expect(() => syncEncounterManifest(db, 'nonexistent', 'fight1'))
      .toThrow('Project not found');
  });

  it('throws for nonexistent encounter_id', () => {
    expect(() => syncEncounterManifest(db, 'test', 'nonexistent'))
      .toThrow('Encounter not found');
  });
});
