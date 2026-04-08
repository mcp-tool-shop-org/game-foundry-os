import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  addUnit,
  validateStructural,
  validateDependencies,
  exportManifest,
  diffManifestVsRuntime,
} from '@mcptoolshop/encounter-doctrine-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let db: Database.Database;
let tmpDir: string;

function seedExportedEncounter() {
  upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
  db.prepare("UPDATE encounters SET display_name = 'Battle', encounter_type = 'standard' WHERE id = 'enc1'").run();

  upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
  upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
  upsertPack(db, { id: 'pack1', project_id: 'test', pack_type: 'enemy', root_path: '/tmp/packs' });

  addUnit(db, {
    encounter_id: 'enc1',
    display_name: 'Goblin',
    variant_id: 'var1',
    sprite_pack: 'pack1',
    team: 'enemy',
    grid_row: 0,
    grid_col: 0,
  });

  validateStructural(db, 'enc1');
  validateDependencies(db, 'enc1');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-diff-'));
  upsertProject(db, 'test', 'Test', tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('diffManifestVsRuntime', () => {
  it('returns match when runtime file hash equals canonical export hash', () => {
    seedExportedEncounter();
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');

    // diff checks the canonical export's manifest_path — which IS the file we just wrote
    const result = diffManifestVsRuntime(db, 'enc1', tmpDir);
    expect(result.status).toBe('match');
    expect(result.canonical_hash).toBeDefined();
    expect(result.runtime_hash).toBe(result.canonical_hash);
  });

  it('returns mismatch when runtime file content differs', () => {
    seedExportedEncounter();
    const exportResult = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');

    // Modify the file on disk
    fs.appendFileSync(exportResult.manifest_path, '\n// modified');

    const result = diffManifestVsRuntime(db, 'enc1', tmpDir);
    expect(result.status).toBe('mismatch');
    expect(result.canonical_hash).not.toBe(result.runtime_hash);
  });

  it('returns missing_runtime when runtime file does not exist', () => {
    seedExportedEncounter();
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');

    // Get canonical export and delete the file
    const row = db.prepare(
      "SELECT manifest_path FROM encounter_exports WHERE encounter_id = 'enc1' AND is_canonical = 1",
    ).get() as { manifest_path: string };
    fs.unlinkSync(row.manifest_path);

    const result = diffManifestVsRuntime(db, 'enc1', tmpDir);
    expect(result.status).toBe('missing_runtime');
    expect(result.canonical_hash).toBeDefined();
    expect(result.runtime_hash).toBeNull();
  });

  it('returns missing_export when no canonical export exists for encounter', () => {
    upsertEncounter(db, { id: 'enc_no_export', project_id: 'test', chapter: 'ch1', label: 'No Export', grid_rows: 3, grid_cols: 8 });

    const result = diffManifestVsRuntime(db, 'enc_no_export', tmpDir);
    expect(result.status).toBe('missing_export');
    expect(result.canonical_hash).toBeNull();
    expect(result.runtime_hash).toBeNull();
    expect(result.manifest_path).toBeNull();
  });

  it('handles encounter with export but deleted runtime path gracefully', () => {
    seedExportedEncounter();
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');

    // Delete the entire encounters directory
    const encDir = path.join(tmpDir, 'encounters');
    fs.rmSync(encDir, { recursive: true, force: true });

    const result = diffManifestVsRuntime(db, 'enc1', tmpDir);
    expect(result.status).toBe('missing_runtime');
  });
});
