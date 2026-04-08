import { describe, it, expect, beforeEach } from 'vitest';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant,
  upsertEncounter, addEnemy, clearEnemies,
  getEncounter, getEncounterEnemies, listEncounters,
  validateBounds, validateFormation, validateVariants,
} from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

describe('encounter-doctrine tool handlers', () => {
  let db: Database.Database;
  const projectId = 'proj_ed';
  const encounterId = 'enc_ed';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'ED Project', '/tmp/ed');

    upsertEncounter(db, {
      id: encounterId,
      project_id: projectId,
      chapter: 'ch1',
      label: 'Forest Ambush',
      doctrine: 'ambush',
      max_turns: 8,
      grid_rows: 3,
      grid_cols: 8,
    });
  });

  it('validate_bounds returns pass for valid encounter', () => {
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'Goblin',
      variant_id: 'goblin_base',
      sprite_pack: 'goblin_pack',
      grid_row: 0,
      grid_col: 2,
    });
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'Wolf',
      variant_id: 'wolf_base',
      sprite_pack: 'wolf_pack',
      grid_row: 2,
      grid_col: 7,
    });

    const result = validateBounds(db, encounterId);
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.enemies).toHaveLength(2);
  });

  it('validate_bounds returns fail with violation details', () => {
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'OutOfBounds',
      variant_id: 'oob_base',
      sprite_pack: 'oob_pack',
      grid_row: 5,
      grid_col: 10,
    });

    const result = validateBounds(db, encounterId);
    expect(result.pass).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0]).toContain('OutOfBounds');
  });

  it('validate_formation detects overlapping positions', () => {
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'A',
      variant_id: 'a_base',
      sprite_pack: 'a_pack',
      grid_row: 1,
      grid_col: 3,
    });
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'B',
      variant_id: 'b_base',
      sprite_pack: 'b_pack',
      grid_row: 1,
      grid_col: 3,
    });

    const result = validateFormation(db, encounterId);
    expect(result.pass).toBe(false);
    const overlapCheck = result.checks.find(c => c.check === 'no_overlap');
    expect(overlapCheck).toBeDefined();
    expect(overlapCheck!.pass).toBe(false);
  });

  it('validate_variants detects missing variant references', () => {
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'Ghost',
      variant_id: 'ghost_base',
      sprite_pack: 'ghost_pack',
      grid_row: 0,
      grid_col: 0,
    });

    const result = validateVariants(db, encounterId);
    expect(result.pass).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.missing.some(m => m.includes('ghost_base'))).toBe(true);
  });

  it('list_encounters filters by project and chapter', () => {
    upsertEncounter(db, { id: 'enc_ch2', project_id: projectId, chapter: 'ch2', label: 'Cave Fight' });
    upsertEncounter(db, { id: 'enc_ch1b', project_id: projectId, chapter: 'ch1', label: 'Bridge Battle' });

    const ch1 = listEncounters(db, { project_id: projectId, chapter: 'ch1' });
    expect(ch1.length).toBe(2); // enc_ed (ch1) + enc_ch1b (ch1)
    expect(ch1.every(e => e.chapter === 'ch1')).toBe(true);

    const all = listEncounters(db, { project_id: projectId });
    expect(all.length).toBe(3);
  });

  it('get_encounter returns encounter with enemies', () => {
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'Orc',
      variant_id: 'orc_base',
      sprite_pack: 'orc_pack',
      grid_row: 1,
      grid_col: 1,
    });

    const encounter = getEncounter(db, encounterId);
    expect(encounter).toBeDefined();
    expect(encounter!.label).toBe('Forest Ambush');
    expect(encounter!.chapter).toBe('ch1');

    const enemies = getEncounterEnemies(db, encounterId);
    expect(enemies).toHaveLength(1);
    expect(enemies[0].display_name).toBe('Orc');
  });

  it('register_encounter creates encounter and replaces enemies on re-register', () => {
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'OldEnemy',
      variant_id: 'old_base',
      sprite_pack: 'old_pack',
      grid_row: 0,
      grid_col: 0,
    });

    let enemies = getEncounterEnemies(db, encounterId);
    expect(enemies).toHaveLength(1);

    // Clear and re-add (simulating re-register behavior)
    clearEnemies(db, encounterId);
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'NewEnemy1',
      variant_id: 'new1_base',
      sprite_pack: 'new1_pack',
      grid_row: 0,
      grid_col: 0,
    });
    addEnemy(db, {
      encounter_id: encounterId,
      display_name: 'NewEnemy2',
      variant_id: 'new2_base',
      sprite_pack: 'new2_pack',
      grid_row: 1,
      grid_col: 1,
    });

    enemies = getEncounterEnemies(db, encounterId);
    expect(enemies).toHaveLength(2);
    expect(enemies.map(e => e.display_name).sort()).toEqual(['NewEnemy1', 'NewEnemy2']);
  });
});
