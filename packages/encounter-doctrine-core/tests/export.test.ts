import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
  upsertEncounter, addEnemy,
} from '@mcptoolshop/game-foundry-registry';
import {
  addUnit,
  attachRule,
  validateStructural,
  validateDependencies,
  exportManifest,
  getExports,
  getCanonicalExport,
} from '@mcptoolshop/encounter-doctrine-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let db: Database.Database;
let tmpDir: string;

function seedValidatedEncounter(id = 'enc1') {
  upsertEncounter(db, { id, project_id: 'test', chapter: 'ch1', label: `Battle ${id}`, grid_rows: 3, grid_cols: 8 });
  db.prepare("UPDATE encounters SET display_name = ?, encounter_type = 'standard' WHERE id = ?")
    .run(`Battle ${id}`, id);

  upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
  upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
  upsertPack(db, { id: 'pack1', project_id: 'test', pack_type: 'enemy', root_path: '/tmp/packs' });

  addUnit(db, {
    encounter_id: id,
    display_name: 'Goblin',
    variant_id: 'var1',
    sprite_pack: 'pack1',
    team: 'enemy',
    grid_row: 0,
    grid_col: 2,
    hp: 30,
  });

  attachRule(db, {
    encounter_id: id,
    rule_type: 'phase_transition',
    rule_key: 'hp_50',
    rule_payload_json: JSON.stringify({ threshold: 0.5 }),
  });

  // Pass both validations so export is allowed
  validateStructural(db, id);
  validateDependencies(db, id);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-export-'));
  upsertProject(db, 'test', 'Test', tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('exportManifest', () => {
  it('creates manifest JSON file at target path', () => {
    seedValidatedEncounter();
    const result = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');
    expect(result.manifest_path).toBeDefined();
    expect(fs.existsSync(result.manifest_path)).toBe(true);

    const content = fs.readFileSync(result.manifest_path, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.encounter_id).toBe('enc1');
  });

  it('manifest includes roster, rules, arena, and encounter metadata', () => {
    seedValidatedEncounter();
    const result = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');
    const manifest = JSON.parse(fs.readFileSync(result.manifest_path, 'utf-8'));

    expect(manifest.encounter_id).toBe('enc1');
    expect(manifest.chapter).toBe('ch1');
    expect(manifest.grid).toEqual({ rows: 3, cols: 8 });
    expect(manifest.enemies).toHaveLength(1);
    expect(manifest.enemies[0].display_name).toBe('Goblin');
    expect(manifest.enemies[0].hp).toBe(30);
    expect(manifest.rules).toHaveLength(1);
    expect(manifest.rules[0].rule_type).toBe('phase_transition');
    expect(manifest.rules[0].rule_key).toBe('hp_50');
    expect(manifest.format_version).toBe('1.0');
  });

  it('records encounter_exports row with content_hash', () => {
    seedValidatedEncounter();
    const result = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');
    expect(result.export_id).toBeDefined();
    expect(result.content_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(result.format_version).toBe('1.0');
  });

  it('getExports returns export history', () => {
    seedValidatedEncounter();
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1_v1.json');
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1_v2.json');

    const exports = getExports(db, 'enc1');
    expect(exports).toHaveLength(2);
  });

  it('getCanonicalExport returns latest canonical export', () => {
    seedValidatedEncounter();
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1_v1.json');
    const second = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1_v2.json');

    const canonical = getCanonicalExport(db, 'enc1');
    expect(canonical).toBeDefined();
    expect(canonical!.id).toBe(second.export_id);
    expect(canonical!.is_canonical).toBe(1);
  });

  it('repeated exports both recorded, latest is canonical', () => {
    seedValidatedEncounter();
    const first = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1_v1.json');
    const second = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1_v2.json');

    const exports = getExports(db, 'enc1');
    const firstExport = exports.find(e => e.id === first.export_id);
    const secondExport = exports.find(e => e.id === second.export_id);

    expect(firstExport!.is_canonical).toBe(0);
    expect(secondExport!.is_canonical).toBe(1);
  });
});
