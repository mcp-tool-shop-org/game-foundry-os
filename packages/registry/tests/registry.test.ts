import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../src/db.js';
import { upsertProject, getProject } from '../src/models/project.js';
import {
  upsertCharacter, getCharacter, listCharacters,
  setProductionState, getCharacterStatus,
} from '../src/models/character.js';
import { upsertVariant, getVariant, listVariantsForCharacter, updateVariantPresence } from '../src/models/variant.js';
import {
  upsertEncounter, addEnemy, getEncounter, getEncounterEnemies,
  validateBounds, validateFormation, validateVariants, clearEnemies,
} from '../src/models/encounter.js';
import { upsertPack, getPack } from '../src/models/pack.js';
import { addFreezeEntry, getFreezeHistory } from '../src/models/freeze.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('schema migration', () => {
  it('creates all tables', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const names = tables.map(t => t.name);
    expect(names).toContain('projects');
    expect(names).toContain('characters');
    expect(names).toContain('variants');
    expect(names).toContain('asset_packs');
    expect(names).toContain('encounters');
    expect(names).toContain('encounter_enemies');
    expect(names).toContain('freeze_log');
    expect(names).toContain('schema_version');
  });

  it('records schema version', () => {
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBeGreaterThanOrEqual(6);
  });

  it('sets WAL mode (or memory equivalent)', () => {
    // In-memory databases may report 'memory' instead of 'wal'
    const mode = db.pragma('journal_mode', { simple: true }) as string;
    expect(['wal', 'memory']).toContain(mode);
  });
});

describe('projects', () => {
  it('creates and retrieves a project', () => {
    const p = upsertProject(db, 'tfr', 'The Fractured Road', 'F:/AI/the-fractured-road');
    expect(p.id).toBe('tfr');
    expect(p.display_name).toBe('The Fractured Road');
    const got = getProject(db, 'tfr');
    expect(got?.root_path).toBe('F:/AI/the-fractured-road');
  });

  it('upsert updates existing project', () => {
    upsertProject(db, 'tfr', 'The Fractured Road', '/old/path');
    upsertProject(db, 'tfr', 'The Fractured Road', '/new/path');
    const got = getProject(db, 'tfr');
    expect(got?.root_path).toBe('/new/path');
  });
});

describe('characters', () => {
  beforeEach(() => {
    upsertProject(db, 'tfr', 'The Fractured Road', '/tmp');
  });

  it('creates a character with defaults', () => {
    const c = upsertCharacter(db, {
      id: 'riot_husk', project_id: 'tfr', display_name: 'Riot Husk',
      role: 'enemy', family: 'undead',
    });
    expect(c.concept_status).toBe('none');
    expect(c.freeze_status).toBe('none');
  });

  it('lists characters filtered by family', () => {
    upsertCharacter(db, { id: 'grubblade', project_id: 'tfr', display_name: 'Grubblade', family: 'goblin' });
    upsertCharacter(db, { id: 'riot_husk', project_id: 'tfr', display_name: 'Riot Husk', family: 'undead' });
    const goblins = listCharacters(db, { family: 'goblin' });
    expect(goblins).toHaveLength(1);
    expect(goblins[0].id).toBe('grubblade');
  });

  it('sets production state', () => {
    upsertCharacter(db, { id: 'riot_husk', project_id: 'tfr', display_name: 'Riot Husk' });
    const result = setProductionState(db, 'riot_husk', 'sheet_status', 'complete');
    expect(result.old_value).toBe('none');
    expect(result.new_value).toBe('complete');
    const updated = getCharacter(db, 'riot_husk');
    expect(updated?.sheet_status).toBe('complete');
  });

  it('rejects invalid production state field', () => {
    upsertCharacter(db, { id: 'riot_husk', project_id: 'tfr', display_name: 'Riot Husk' });
    expect(() => setProductionState(db, 'riot_husk', 'bogus_field', 'complete'))
      .toThrow('Invalid production state field');
  });

  it('derives next step correctly', () => {
    upsertCharacter(db, { id: 'riot_husk', project_id: 'tfr', display_name: 'Riot Husk' });
    const s1 = getCharacterStatus(db, 'riot_husk');
    expect(s1?.next_step).toBe('Generate concept batch');

    setProductionState(db, 'riot_husk', 'concept_status', 'complete');
    const s2 = getCharacterStatus(db, 'riot_husk');
    expect(s2?.next_step).toBe('Generate directional batch');

    setProductionState(db, 'riot_husk', 'freeze_status', 'frozen');
    const s3 = getCharacterStatus(db, 'riot_husk');
    expect(s3?.next_step).toBe('Frozen — no action needed');
  });
});

describe('variants', () => {
  beforeEach(() => {
    upsertProject(db, 'tfr', 'The Fractured Road', '/tmp');
    upsertCharacter(db, { id: 'avar', project_id: 'tfr', display_name: 'Marshal Avar', role: 'boss' });
  });

  it('creates base and phase2 variants', () => {
    upsertVariant(db, { id: 'avar_armed', character_id: 'avar', variant_type: 'base', phase: 1 });
    upsertVariant(db, { id: 'avar_desperate', character_id: 'avar', variant_type: 'phase2', phase: 2 });
    const variants = listVariantsForCharacter(db, 'avar');
    expect(variants).toHaveLength(2);
    expect(variants[0].variant_type).toBe('base');
    expect(variants[1].variant_type).toBe('phase2');
  });

  it('updates presence flags', () => {
    upsertVariant(db, { id: 'avar_armed', character_id: 'avar', variant_type: 'base' });
    updateVariantPresence(db, 'avar_armed', { sheet_present: 1, pack_present: 1, directions_present: 8 });
    const v = getVariant(db, 'avar_armed');
    expect(v?.sheet_present).toBe(1);
    expect(v?.pack_present).toBe(1);
    expect(v?.directions_present).toBe(8);
  });
});

describe('encounters + validation', () => {
  beforeEach(() => {
    upsertProject(db, 'tfr', 'The Fractured Road', '/tmp');
    upsertCharacter(db, { id: 'grubblade_char', project_id: 'tfr', display_name: 'Grubblade', role: 'enemy' });
    upsertVariant(db, { id: 'grubblade', character_id: 'grubblade_char', variant_type: 'base' });
    upsertPack(db, { id: 'ch1-enemies', project_id: 'tfr', pack_type: 'enemy', root_path: 'assets/sprites/ch1-enemies' });
  });

  it('creates encounter with enemies', () => {
    upsertEncounter(db, {
      id: 'goblin_opener', project_id: 'tfr', chapter: 'ch1', label: 'Raider Ambush',
      grid_rows: 3, grid_cols: 8,
    });
    addEnemy(db, {
      encounter_id: 'goblin_opener', display_name: 'Grubblade', variant_id: 'grubblade',
      sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 5, hp: 8, guard: 3,
    });
    const enemies = getEncounterEnemies(db, 'goblin_opener');
    expect(enemies).toHaveLength(1);
    expect(enemies[0].grid_row).toBe(1);
    expect(enemies[0].grid_col).toBe(5);
  });

  it('validates bounds — pass', () => {
    upsertEncounter(db, { id: 'valid', project_id: 'tfr', chapter: 'ch1', label: 'Valid', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'valid', display_name: 'Grubblade', variant_id: 'grubblade', sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 5 });
    const result = validateBounds(db, 'valid');
    expect(result.pass).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('validates bounds — fail (row out of range)', () => {
    upsertEncounter(db, { id: 'broken', project_id: 'tfr', chapter: 'ch1', label: 'Broken', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'broken', display_name: 'Grubblade', variant_id: 'grubblade', sprite_pack: 'ch1-enemies', grid_row: 4, grid_col: 3 });
    const result = validateBounds(db, 'broken');
    expect(result.pass).toBe(false);
    expect(result.violations[0]).toContain('row=4');
    expect(result.violations[0]).toContain('outside 3×8 grid');
  });

  it('validates formation — overlapping positions detected', () => {
    upsertEncounter(db, { id: 'overlap', project_id: 'tfr', chapter: 'ch1', label: 'Overlap', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'overlap', display_name: 'G1', variant_id: 'grubblade', sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 5 });
    addEnemy(db, { encounter_id: 'overlap', display_name: 'G2', variant_id: 'grubblade', sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 5 });
    const result = validateFormation(db, 'overlap');
    expect(result.pass).toBe(false);
    expect(result.checks.find(c => c.check === 'no_overlap')?.pass).toBe(false);
  });

  it('validates variants — pass when variant and pack exist', () => {
    upsertEncounter(db, { id: 'good', project_id: 'tfr', chapter: 'ch1', label: 'Good', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'good', display_name: 'Grubblade', variant_id: 'grubblade', sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 5 });
    const result = validateVariants(db, 'good');
    expect(result.pass).toBe(true);
  });

  it('validates variants — fail when variant missing', () => {
    upsertEncounter(db, { id: 'bad', project_id: 'tfr', chapter: 'ch1', label: 'Bad', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'bad', display_name: 'Ghost', variant_id: 'nonexistent', sprite_pack: 'ch1-enemies', grid_row: 1, grid_col: 5 });
    const result = validateVariants(db, 'bad');
    expect(result.pass).toBe(false);
    expect(result.missing).toContain("variant 'nonexistent' for Ghost");
  });
});

describe('freeze log', () => {
  it('records freeze entries with content hash', () => {
    const entry = addFreezeEntry(db, 'character', 'riot_husk', 'sha256:abc123', 'bootstrap', 'Ch1 freeze');
    expect(entry.content_hash).toBe('sha256:abc123');
    const history = getFreezeHistory(db, 'character', 'riot_husk');
    expect(history).toHaveLength(1);
    expect(history[0].frozen_by).toBe('bootstrap');
  });

  it('freeze log is append-only (multiple entries)', () => {
    addFreezeEntry(db, 'encounter', 'avar_boss', 'hash1', 'manual');
    addFreezeEntry(db, 'encounter', 'avar_boss', 'hash2', 'proof-lab');
    const history = getFreezeHistory(db, 'encounter', 'avar_boss');
    expect(history).toHaveLength(2);
    const hashes = history.map(h => h.content_hash);
    expect(hashes).toContain('hash1');
    expect(hashes).toContain('hash2');
  });
});
