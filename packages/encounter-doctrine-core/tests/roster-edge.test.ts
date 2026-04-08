import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import { addUnit, moveUnit, getUnits } from '@mcptoolshop/encounter-doctrine-core';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test', '/tmp/test');
  upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
});

describe('roster edge cases', () => {
  it('addUnit with all optional fields populated (engine_profile_json, spawn_group, facing)', () => {
    const unit = addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Elite Guard',
      variant_id: 'guard_base',
      sprite_pack: 'guard_pack',
      team: 'enemy',
      role_tag: 'boss',
      ai_role: 'guardian',
      grid_row: 1,
      grid_col: 4,
      hp: 100,
      guard: 25,
      speed: 5,
      move_range: 2,
      facing: 'south',
      spawn_group: 'wave_2',
      engine_profile_json: JSON.stringify({ aggression: 0.8, retreat_threshold: 0.2 }),
      character_id: 'char_guard',
      engine_data: { loot_table: 'boss_loot' },
      sort_order: 1,
    });

    expect(unit.display_name).toBe('Elite Guard');
    expect(unit.team).toBe('enemy');
    expect(unit.role_tag).toBe('boss');
    expect(unit.facing).toBe('south');
    expect(unit.spawn_group).toBe('wave_2');
    expect(unit.engine_profile_json).toBeDefined();
    const profile = JSON.parse(unit.engine_profile_json!);
    expect(profile.aggression).toBe(0.8);
    expect(unit.character_id).toBe('char_guard');
  });

  it('moveUnit updates only specified fields, preserves others', () => {
    const unit = addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Goblin',
      variant_id: 'goblin_base',
      sprite_pack: 'goblin_pack',
      grid_row: 0,
      grid_col: 0,
      facing: 'north',
      spawn_group: 'wave_1',
    });

    // Move only grid position
    const moved = moveUnit(db, unit.id, { grid_row: 2, grid_col: 5 });
    expect(moved.grid_row).toBe(2);
    expect(moved.grid_col).toBe(5);
    expect(moved.facing).toBe('north'); // preserved
    expect(moved.spawn_group).toBe('wave_1'); // preserved

    // Update only facing
    const faced = moveUnit(db, unit.id, { facing: 'east' });
    expect(faced.grid_row).toBe(2); // preserved
    expect(faced.facing).toBe('east');
  });

  it('getUnits returns empty array for encounter with no units', () => {
    const units = getUnits(db, 'enc1');
    expect(units).toHaveLength(0);
    expect(Array.isArray(units)).toBe(true);
  });

  it('addUnit with character_id field', () => {
    const unit = addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Named NPC',
      variant_id: 'npc_base',
      sprite_pack: 'npc_pack',
      grid_row: 1,
      grid_col: 1,
      character_id: 'char_npc_001',
    });

    expect(unit.character_id).toBe('char_npc_001');
  });

  it('multiple units at same position (no auto-validation in roster layer)', () => {
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Unit A',
      variant_id: 'a_base',
      sprite_pack: 'a_pack',
      grid_row: 1,
      grid_col: 3,
    });

    // Same position — roster layer does NOT validate
    const unitB = addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Unit B',
      variant_id: 'b_base',
      sprite_pack: 'b_pack',
      grid_row: 1,
      grid_col: 3,
    });

    expect(unitB.grid_row).toBe(1);
    expect(unitB.grid_col).toBe(3);

    const units = getUnits(db, 'enc1');
    expect(units).toHaveLength(2);
  });
});
