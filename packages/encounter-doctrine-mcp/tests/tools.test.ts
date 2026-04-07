import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDatabase,
  upsertProject,
  upsertEncounter,
  addEnemy,
  clearEnemies,
  validateBounds,
  validateFormation,
  getEncounterEnemies,
} from '@mcptoolshop/game-foundry-registry';
import { buildManifest } from '../src/tools/exportManifest.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test-project', 'Test Project', '/tmp/test');
});

function seedEncounter(id: string, gridRows = 3, gridCols = 8) {
  return upsertEncounter(db, {
    id,
    project_id: 'test-project',
    chapter: 'ch1',
    label: `Test Encounter ${id}`,
    grid_rows: gridRows,
    grid_cols: gridCols,
  });
}

function seedEnemy(encounterId: string, name: string, row: number, col: number, overrides?: {
  hp?: number;
  guard?: number;
  speed?: number;
  move_range?: number;
  ai_role?: string;
  engine_data?: Record<string, unknown>;
}) {
  return addEnemy(db, {
    encounter_id: encounterId,
    display_name: name,
    variant_id: `variant-${name.toLowerCase().replace(/\s+/g, '-')}`,
    sprite_pack: 'ch1-enemies',
    grid_row: row,
    grid_col: col,
    ai_role: overrides?.ai_role,
    hp: overrides?.hp,
    guard: overrides?.guard,
    speed: overrides?.speed,
    move_range: overrides?.move_range,
    engine_data: overrides?.engine_data,
  });
}

describe('validateBounds', () => {
  it('passes when all enemies are within grid bounds', () => {
    seedEncounter('goblin_opener', 3, 8);
    seedEnemy('goblin_opener', 'Grubblade', 0, 5);
    seedEnemy('goblin_opener', 'Thornbug', 2, 7);

    const result = validateBounds(db, 'goblin_opener');
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.enemies).toHaveLength(2);
    expect(result.enemies[0].in_bounds).toBe(true);
    expect(result.enemies[1].in_bounds).toBe(true);
  });

  it('fails when an enemy has row >= grid_rows', () => {
    seedEncounter('oob_encounter', 3, 8);
    seedEnemy('oob_encounter', 'ValidGoblin', 1, 5);
    seedEnemy('oob_encounter', 'OutOfBoundsGoblin', 4, 3);

    const result = validateBounds(db, 'oob_encounter');
    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('OutOfBoundsGoblin');
    expect(result.violations[0]).toContain('row=4');

    const oob = result.enemies.find(e => e.name === 'OutOfBoundsGoblin');
    expect(oob?.in_bounds).toBe(false);

    const valid = result.enemies.find(e => e.name === 'ValidGoblin');
    expect(valid?.in_bounds).toBe(true);
  });
});

describe('validateFormation', () => {
  it('fails when two enemies share the same position', () => {
    seedEncounter('overlap_encounter', 3, 8);
    seedEnemy('overlap_encounter', 'Goblin A', 1, 5);
    seedEnemy('overlap_encounter', 'Goblin B', 1, 5);

    const result = validateFormation(db, 'overlap_encounter');
    expect(result.pass).toBe(false);

    const overlapCheck = result.checks.find(c => c.check === 'no_overlap');
    expect(overlapCheck?.pass).toBe(false);
    expect(overlapCheck?.detail).toContain('Goblin B');
  });

  it('passes when all positions are unique', () => {
    seedEncounter('clean_encounter', 3, 8);
    seedEnemy('clean_encounter', 'Goblin A', 0, 3);
    seedEnemy('clean_encounter', 'Goblin B', 1, 5);
    seedEnemy('clean_encounter', 'Goblin C', 2, 7);

    const result = validateFormation(db, 'clean_encounter');
    expect(result.pass).toBe(true);
    expect(result.checks.every(c => c.pass)).toBe(true);
  });
});

describe('exportManifest', () => {
  it('produces gdscript_array in the correct Godot format', () => {
    seedEncounter('export_test', 3, 8);
    seedEnemy('export_test', 'Grubblade', 1, 5, {
      hp: 8,
      guard: 3,
      speed: 9,
      move_range: 3,
      ai_role: 'center_holder',
      engine_data: { resist_fire: true },
    });
    seedEnemy('export_test', 'Thornbug', 0, 6, {
      hp: 5,
      guard: 1,
      speed: 12,
      move_range: 4,
      ai_role: 'flanker',
    });

    const enemies = getEncounterEnemies(db, 'export_test');
    const manifest = buildManifest('export_test', enemies);

    expect(manifest.encounter_id).toBe('export_test');
    expect(manifest.gdscript_array).toHaveLength(2);

    const grubblade = manifest.gdscript_array[0];
    expect(grubblade.name).toBe('Grubblade');
    expect(grubblade.hp).toBe(8);
    expect(grubblade.guard).toBe(3);
    expect(grubblade.speed).toBe(9);
    expect(grubblade.move).toBe(3);
    expect(grubblade.ai_role).toBe('center_holder');
    expect(grubblade.engine).toEqual({ resist_fire: true });
    expect(grubblade.grid_pos).toBe('Vector2i(1, 5)');
    expect(grubblade.sprite_pack).toBe('ch1-enemies');
    expect(grubblade.sprite_variant).toBe('variant-grubblade');

    const thornbug = manifest.gdscript_array[1];
    expect(thornbug.grid_pos).toBe('Vector2i(0, 6)');
    expect(thornbug.engine).toEqual({});
    expect(thornbug.move).toBe(4);
  });

  it('defaults numeric fields to 0 and ai_role to "none" when unset', () => {
    seedEncounter('defaults_test', 3, 8);
    seedEnemy('defaults_test', 'Bare', 0, 0);

    const enemies = getEncounterEnemies(db, 'defaults_test');
    const manifest = buildManifest('defaults_test', enemies);

    const bare = manifest.gdscript_array[0];
    expect(bare.hp).toBe(0);
    expect(bare.guard).toBe(0);
    expect(bare.speed).toBe(0);
    expect(bare.move).toBe(0);
    expect(bare.ai_role).toBe('none');
    expect(bare.engine).toEqual({});
  });
});
