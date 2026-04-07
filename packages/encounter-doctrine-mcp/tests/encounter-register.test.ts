import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
  upsertPack,
  upsertEncounter,
  addEnemy,
  clearEnemies,
  getEncounterEnemies,
  validateBounds,
} from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test', '/tmp');
  upsertCharacter(db, { id: 'goblin', project_id: 'test', display_name: 'Goblin', role: 'enemy' });
  upsertVariant(db, { id: 'grubblade', character_id: 'goblin', variant_type: 'base' });
  upsertPack(db, { id: 'ch1-enemies', project_id: 'test', pack_type: 'enemy', root_path: '/pack' });
});

describe('register encounter tool logic', () => {
  it('creates encounter with enemies in one call', () => {
    upsertEncounter(db, {
      id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Ambush',
      grid_rows: 3, grid_cols: 8,
    });
    addEnemy(db, {
      encounter_id: 'enc1', display_name: 'Grubblade', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 5, hp: 8, guard: 3,
    });
    addEnemy(db, {
      encounter_id: 'enc1', display_name: 'Grubblade B', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 0, grid_col: 7, hp: 5, guard: 2,
    });

    const enemies = getEncounterEnemies(db, 'enc1');
    expect(enemies).toHaveLength(2);
    expect(enemies[0].display_name).toBe('Grubblade');
    expect(enemies[1].display_name).toBe('Grubblade B');
  });

  it('re-registering replaces enemies (idempotent)', () => {
    upsertEncounter(db, {
      id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Ambush',
      grid_rows: 3, grid_cols: 8,
    });
    addEnemy(db, {
      encounter_id: 'enc1', display_name: 'Old', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 0, grid_col: 0,
    });

    // Re-register: clear then add new
    clearEnemies(db, 'enc1');
    addEnemy(db, {
      encounter_id: 'enc1', display_name: 'New A', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 3,
    });
    addEnemy(db, {
      encounter_id: 'enc1', display_name: 'New B', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 2, grid_col: 5,
    });

    const enemies = getEncounterEnemies(db, 'enc1');
    expect(enemies).toHaveLength(2);
    expect(enemies.map(e => e.display_name)).toEqual(['New A', 'New B']);
  });

  it('validates bounds automatically after registration', () => {
    upsertEncounter(db, {
      id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Bounded',
      grid_rows: 3, grid_cols: 8,
    });
    addEnemy(db, {
      encounter_id: 'enc1', display_name: 'Grubblade', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 2, grid_col: 7,
    });

    const result = validateBounds(db, 'enc1');
    expect(result.pass).toBe(true);
    expect(result.grid).toEqual({ rows: 3, cols: 8 });
    expect(result.enemies[0].in_bounds).toBe(true);
  });

  it('handles encounter with engine_data JSON in enemies', () => {
    upsertEncounter(db, {
      id: 'boss', project_id: 'test', chapter: 'ch1', label: 'Boss Fight',
      grid_rows: 3, grid_cols: 8,
    });
    addEnemy(db, {
      encounter_id: 'boss', display_name: 'Marshal Avar', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 6, hp: 18, guard: 8,
      engine_data: { phase: 1, phase2_variant: 'avar_desperate', transition_hp: 8 },
    });

    const enemies = getEncounterEnemies(db, 'boss');
    expect(enemies).toHaveLength(1);
    // engine_data is stored as JSON string in SQLite
    const parsed = JSON.parse(enemies[0].engine_data as string);
    expect(parsed.phase).toBe(1);
    expect(parsed.phase2_variant).toBe('avar_desperate');
    expect(parsed.transition_hp).toBe(8);
  });
});
