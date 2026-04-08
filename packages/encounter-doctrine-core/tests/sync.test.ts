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
  syncToEngine,
  getSyncReceipts,
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
  exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-sync-'));
  upsertProject(db, 'test', 'Test', tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('syncToEngine', () => {
  it('copies manifest to target runtime path', () => {
    seedExportedEncounter();
    const targetPath = path.join(tmpDir, 'runtime', 'encounters', 'enc1.json');
    const result = syncToEngine(db, 'enc1', 'test', targetPath);

    expect(fs.existsSync(result.target_path)).toBe(true);
    const content = JSON.parse(fs.readFileSync(result.target_path, 'utf-8'));
    expect(content.encounter_id).toBe('enc1');
  });

  it('creates encounter_sync_receipts row', () => {
    seedExportedEncounter();
    const targetPath = path.join(tmpDir, 'runtime', 'enc1.json');
    const result = syncToEngine(db, 'enc1', 'test', targetPath);

    expect(result.receipt_id).toBeDefined();
    expect(result.synced_files).toHaveLength(1);
  });

  it('receipt has correct encounter_id and target_path', () => {
    seedExportedEncounter();
    const targetPath = path.join(tmpDir, 'runtime', 'enc1.json');
    const result = syncToEngine(db, 'enc1', 'test', targetPath);

    expect(result.encounter_id).toBe('enc1');
    expect(result.target_path).toBe(path.resolve(targetPath));
  });

  it('getSyncReceipts returns sync history', () => {
    seedExportedEncounter();
    syncToEngine(db, 'enc1', 'test', path.join(tmpDir, 'rt1', 'enc1.json'));
    syncToEngine(db, 'enc1', 'test', path.join(tmpDir, 'rt2', 'enc1.json'));

    const receipts = getSyncReceipts(db, 'enc1');
    expect(receipts).toHaveLength(2);
    expect(receipts[0].encounter_id).toBe('enc1');
    expect(receipts[1].encounter_id).toBe('enc1');
  });

  it('verification_status defaults to verified for successful write', () => {
    seedExportedEncounter();
    const targetPath = path.join(tmpDir, 'runtime', 'enc1.json');
    const result = syncToEngine(db, 'enc1', 'test', targetPath);

    expect(result.verification_status).toBe('verified');
  });
});
