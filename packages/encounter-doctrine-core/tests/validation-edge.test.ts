import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  addUnit,
  attachRule,
  validateStructural,
  validateDependencies,
  getValidationHistory,
} from '@mcptoolshop/encounter-doctrine-core';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test', '/tmp/test');
});

describe('validation edge cases', () => {
  it('structural validation fails for unit at negative coordinates', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Bad Position',
      variant_id: 'v1',
      sprite_pack: 'p1',
      grid_row: -1,
      grid_col: 2,
    });

    const report = validateStructural(db, 'enc1');
    expect(report.pass).toBe(false);
    expect((report.details as any).issues.some((i: string) => i.includes('Bad Position'))).toBe(true);
  });

  it('structural validation passes with unit at grid boundary (row=2, col=7 on 3x8)', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Edge Unit',
      variant_id: 'v1',
      sprite_pack: 'p1',
      grid_row: 2,
      grid_col: 7,
    });

    const report = validateStructural(db, 'enc1');
    expect(report.pass).toBe(true);
    expect((report.details as any).issues).toHaveLength(0);
  });

  it('structural validation fails when encounter has zero enemy-team units', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Empty', grid_rows: 3, grid_cols: 8 });

    const report = validateStructural(db, 'enc1');
    expect(report.pass).toBe(false);
    expect((report.details as any).issues.some((i: string) => i.includes('empty'))).toBe(true);
  });

  it('dependency validation fails when phase2 variant in rule does not exist', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char' });
    upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
    upsertPack(db, { id: 'pack1', project_id: 'test', pack_type: 'enemy', root_path: '/tmp' });

    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Boss',
      variant_id: 'var1',
      sprite_pack: 'pack1',
      grid_row: 0,
      grid_col: 0,
    });

    // Rule references a phase2 variant that doesn't exist
    attachRule(db, {
      encounter_id: 'enc1',
      rule_type: 'phase_transition',
      rule_key: 'hp_50',
      rule_payload_json: JSON.stringify({ phase2_variant_id: 'var1_phase2_nonexistent' }),
    });

    const report = validateDependencies(db, 'enc1');
    expect(report.pass).toBe(false);
    expect((report.details as any).missing_variants).toContain('var1_phase2_nonexistent');
  });

  it('dependency validation reports ALL missing dependencies in one call', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });

    // Two units with missing variants and packs
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Ghost A',
      variant_id: 'missing_var_a',
      sprite_pack: 'missing_pack_a',
      grid_row: 0,
      grid_col: 0,
    });
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Ghost B',
      variant_id: 'missing_var_b',
      sprite_pack: 'missing_pack_b',
      grid_row: 1,
      grid_col: 1,
    });

    const report = validateDependencies(db, 'enc1');
    expect(report.pass).toBe(false);
    expect((report.details as any).missing_variants).toContain('missing_var_a');
    expect((report.details as any).missing_variants).toContain('missing_var_b');
    expect((report.details as any).missing_packs).toContain('missing_pack_a');
    expect((report.details as any).missing_packs).toContain('missing_pack_b');
    expect((report.details as any).issues.length).toBeGreaterThanOrEqual(4);
  });

  it('getValidationHistory returns runs in chronological order', () => {
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
    validateDependencies(db, 'enc1');

    const history = getValidationHistory(db, 'enc1');
    expect(history).toHaveLength(2);
    expect(history[0].validation_type).toBe('structural');
    expect(history[1].validation_type).toBe('dependencies');
    // Chronological order
    expect(history[0].created_at <= history[1].created_at).toBe(true);
  });
});
