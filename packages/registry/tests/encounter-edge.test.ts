import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../src/db.js';
import { upsertProject } from '../src/models/project.js';
import { upsertCharacter } from '../src/models/character.js';
import { upsertVariant } from '../src/models/variant.js';
import { upsertPack } from '../src/models/pack.js';
import {
  upsertEncounter, addEnemy, clearEnemies, getEncounterEnemies,
  listEncounters, validateBounds,
} from '../src/models/encounter.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'tfr', 'The Fractured Road', '/tmp');
  upsertCharacter(db, { id: 'g1', project_id: 'tfr', display_name: 'Goblin', role: 'enemy' });
  upsertVariant(db, { id: 'g1-base', character_id: 'g1', variant_type: 'base' });
  upsertPack(db, { id: 'ch1-enemies', project_id: 'tfr', pack_type: 'enemy', root_path: '/pack' });
});

function seed(encId: string, chapter: string, projectId = 'tfr') {
  return upsertEncounter(db, {
    id: encId, project_id: projectId, chapter, label: `Enc ${encId}`, grid_rows: 3, grid_cols: 8,
  });
}

function enemy(encId: string, name: string, row: number, col: number) {
  return addEnemy(db, {
    encounter_id: encId, display_name: name, variant_id: 'g1-base',
    sprite_pack: 'ch1-enemies', grid_row: row, grid_col: col,
  });
}

describe('encounter edge cases', () => {
  it('clearEnemies removes all enemies for an encounter', () => {
    seed('enc1', 'ch1');
    enemy('enc1', 'A', 0, 0);
    enemy('enc1', 'B', 1, 1);
    expect(getEncounterEnemies(db, 'enc1')).toHaveLength(2);

    clearEnemies(db, 'enc1');
    expect(getEncounterEnemies(db, 'enc1')).toHaveLength(0);
  });

  it('clearEnemies does not affect other encounters', () => {
    seed('enc1', 'ch1');
    seed('enc2', 'ch1');
    enemy('enc1', 'A', 0, 0);
    enemy('enc2', 'B', 1, 1);

    clearEnemies(db, 'enc1');
    expect(getEncounterEnemies(db, 'enc1')).toHaveLength(0);
    expect(getEncounterEnemies(db, 'enc2')).toHaveLength(1);
  });

  it('listEncounters filters by chapter', () => {
    seed('enc1', 'ch1');
    seed('enc2', 'ch2');
    seed('enc3', 'ch1');

    const ch1 = listEncounters(db, { chapter: 'ch1' });
    expect(ch1).toHaveLength(2);
    expect(ch1.map(e => e.id)).toContain('enc1');
    expect(ch1.map(e => e.id)).toContain('enc3');
  });

  it('listEncounters filters by project_id', () => {
    upsertProject(db, 'other', 'Other', '/other');
    seed('enc1', 'ch1', 'tfr');
    seed('enc2', 'ch1', 'other');

    const tfrOnly = listEncounters(db, { project_id: 'tfr' });
    expect(tfrOnly).toHaveLength(1);
    expect(tfrOnly[0].id).toBe('enc1');
  });

  it('validateBounds on empty encounter passes (no enemies = no violations)', () => {
    seed('empty', 'ch1');
    const result = validateBounds(db, 'empty');
    expect(result.pass).toBe(true);
    expect(result.enemies).toHaveLength(0);
    expect(result.violations).toHaveLength(0);
  });
});
