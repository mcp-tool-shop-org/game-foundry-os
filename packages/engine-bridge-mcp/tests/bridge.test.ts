import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant,
  upsertPack, updateVariantPresence, setProductionState,
  upsertEncounter, addEnemy,
} from '@mcptoolshop/game-foundry-registry';
import { checkPackDirections, countDirectionFiles, checkPortraits, checkDirectionalSource } from '../src/utils/godot.js';
import { verifyRuntimePaths } from '../src/tools/verifyRuntimePaths.js';
import { reportPlaceholders } from '../src/tools/reportPlaceholders.js';
import { reportUnintegrated } from '../src/tools/reportUnintegrated.js';
import { getBattleRuntimeStatus } from '../src/tools/getBattleRuntimeStatus.js';
import { syncSpritePack } from '../src/tools/syncSpritePack.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let tmpDir: string;

const DIRECTIONS = ['front', 'front_left', 'left', 'back_left', 'back', 'back_right', 'right', 'front_right'];

function buildPackDir(root: string, pack: string, variant: string, dirCount: number = 8, withImports: boolean = true): string {
  const albedoDir = path.join(root, 'assets', 'sprites', pack, 'assets', variant, 'albedo');
  fs.mkdirSync(albedoDir, { recursive: true });
  for (let i = 0; i < dirCount && i < DIRECTIONS.length; i++) {
    fs.writeFileSync(path.join(albedoDir, `${DIRECTIONS[i]}.png`), 'fake');
    if (withImports) {
      fs.writeFileSync(path.join(albedoDir, `${DIRECTIONS[i]}.png.import`), 'fake');
    }
  }
  return albedoDir;
}

function buildDirectionalDir(root: string, charId: string): void {
  const dirs = ['front', 'front_34', 'side', 'back_34', 'back'];
  for (const d of dirs) {
    const dirPath = path.join(root, 'assets', 'sprites', 'directional', charId, d);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, `${charId}_${d}_01.png`), 'fake');
  }
}

function buildPortrait(root: string, name: string): void {
  const dir = path.join(root, 'assets', 'portraits', 'gate_test');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name.toLowerCase()}_80x80.png`), 'fake');
  fs.writeFileSync(path.join(dir, `${name.toLowerCase()}_28x28.png`), 'fake');
}

function seedProject(root: string): void {
  upsertProject(db, 'test-project', 'Test Project', root);
  upsertPack(db, { id: 'enemies', project_id: 'test-project', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
  upsertPack(db, { id: 'party', project_id: 'test-project', pack_type: 'party', root_path: 'assets/sprites/party' });
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-bridge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Godot utility tests ─────────────────────────────────────

describe('godot utils', () => {
  it('checkPackDirections reports all 8 directions', () => {
    const albedoDir = buildPackDir(tmpDir, 'pack', 'variant', 8, true);
    const checks = checkPackDirections(albedoDir);
    expect(checks).toHaveLength(8);
    expect(checks.every(c => c.png_exists && c.import_exists)).toBe(true);
  });

  it('countDirectionFiles returns 0 for missing directory', () => {
    const counts = countDirectionFiles(path.join(tmpDir, 'nonexistent'));
    expect(counts.pngs).toBe(0);
    expect(counts.imports).toBe(0);
  });

  it('detects partial directions (5 of 8)', () => {
    const albedoDir = buildPackDir(tmpDir, 'pack', 'partial', 5);
    const counts = countDirectionFiles(albedoDir);
    expect(counts.pngs).toBe(5);
    expect(counts.imports).toBe(5);
  });

  it('checkPortraits finds existing portraits', () => {
    buildPortrait(tmpDir, 'Maren');
    const result = checkPortraits(tmpDir, 'Maren');
    expect(result.has_80).toBe(true);
    expect(result.has_28).toBe(true);
  });

  it('checkPortraits returns false for missing', () => {
    const result = checkPortraits(tmpDir, 'Drift');
    expect(result.has_80).toBe(false);
    expect(result.has_28).toBe(false);
  });

  it('checkDirectionalSource counts 5 dirs', () => {
    buildDirectionalDir(tmpDir, 'maren');
    const result = checkDirectionalSource(tmpDir, 'maren');
    expect(result.dirs_present).toBe(5);
    expect(result.complete).toBe(true);
    expect(result.total_frames).toBe(5);
  });
});

// ─── verify_runtime_paths ────────────────────────────────────

describe('verifyRuntimePaths', () => {
  it('passes when all pack files and imports exist', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'grunt', project_id: 'test-project', display_name: 'Grunt', role: 'enemy' });
    upsertVariant(db, { id: 'grunt', character_id: 'grunt', variant_type: 'base', pack_id: 'enemies', pack_dir: 'assets/sprites/enemies/assets/grunt/albedo' });
    buildPackDir(tmpDir, 'enemies', 'grunt', 8, true);

    const result = verifyRuntimePaths(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('fails when PNGs are missing', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'ghost', project_id: 'test-project', display_name: 'Ghost', role: 'enemy' });
    upsertVariant(db, { id: 'ghost', character_id: 'ghost', variant_type: 'base', pack_id: 'enemies', pack_dir: 'assets/sprites/enemies/assets/ghost/albedo' });
    buildPackDir(tmpDir, 'enemies', 'ghost', 3, true);

    const result = verifyRuntimePaths(db, 'test-project');
    expect(result.pass).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]).toContain('3/8');
  });
});

// ─── report_placeholders ─────────────────────────────────────

describe('reportPlaceholders', () => {
  it('reports no placeholders when all sprites exist', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'knight', project_id: 'test-project', display_name: 'Knight', role: 'party' });
    upsertVariant(db, { id: 'knight', character_id: 'knight', variant_type: 'base', pack_id: 'party' });
    buildPackDir(tmpDir, 'party', 'knight', 8);

    const result = reportPlaceholders(db, 'test-project');
    expect(result.placeholder_count).toBe(0);
    expect(result.total_checked).toBe(1);
  });

  it('detects placeholder when no PNGs exist', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'missing', project_id: 'test-project', display_name: 'Missing', role: 'party' });
    upsertVariant(db, { id: 'missing', character_id: 'missing', variant_type: 'base', pack_id: 'party' });
    // Don't create any files

    const result = reportPlaceholders(db, 'test-project');
    expect(result.placeholder_count).toBe(1);
    expect(result.placeholders[0].reason).toContain('placeholder circle');
  });

  it('detects partial placeholder (some directions missing)', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'partial', project_id: 'test-project', display_name: 'Partial', role: 'enemy' });
    upsertVariant(db, { id: 'partial', character_id: 'partial', variant_type: 'base', pack_id: 'enemies' });
    buildPackDir(tmpDir, 'enemies', 'partial', 4);

    const result = reportPlaceholders(db, 'test-project');
    expect(result.placeholder_count).toBe(1);
    expect(result.placeholders[0].reason).toContain('4/8');
  });
});

// ─── report_unintegrated ─────────────────────────────────────

describe('reportUnintegrated', () => {
  it('reports character with pack_status=complete but missing .import files', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'soldier', project_id: 'test-project', display_name: 'Soldier', role: 'enemy' });
    setProductionState(db, 'soldier', 'pack_status', 'complete');
    setProductionState(db, 'soldier', 'integration_status', 'complete');
    upsertVariant(db, { id: 'soldier', character_id: 'soldier', variant_type: 'base', pack_id: 'enemies' });
    buildPackDir(tmpDir, 'enemies', 'soldier', 8, false); // PNGs but NO .import files

    const result = reportUnintegrated(db, 'test-project');
    expect(result.count).toBe(1);
    expect(result.unintegrated[0].gap).toContain('.import');
  });

  it('reports nothing when everything is truly integrated', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'warrior', project_id: 'test-project', display_name: 'Warrior', role: 'enemy' });
    setProductionState(db, 'warrior', 'pack_status', 'complete');
    setProductionState(db, 'warrior', 'integration_status', 'complete');
    upsertVariant(db, { id: 'warrior', character_id: 'warrior', variant_type: 'base', pack_id: 'enemies' });
    buildPackDir(tmpDir, 'enemies', 'warrior', 8, true);

    const result = reportUnintegrated(db, 'test-project');
    expect(result.count).toBe(0);
  });
});

// ─── get_battle_runtime_status ───────────────────────────────

describe('getBattleRuntimeStatus', () => {
  it('reports complete party and encounters', () => {
    seedProject(tmpDir);

    // One party member
    upsertCharacter(db, { id: 'hero', project_id: 'test-project', display_name: 'Hero', role: 'party' });
    upsertVariant(db, { id: 'hero', character_id: 'hero', variant_type: 'base', pack_id: 'party' });
    buildPackDir(tmpDir, 'party', 'hero', 8, true);
    buildPortrait(tmpDir, 'Hero');

    // One encounter
    upsertCharacter(db, { id: 'goblin', project_id: 'test-project', display_name: 'Goblin', role: 'enemy' });
    upsertVariant(db, { id: 'goblin', character_id: 'goblin', variant_type: 'base', pack_id: 'enemies' });
    buildPackDir(tmpDir, 'enemies', 'goblin', 8, true);

    upsertEncounter(db, { id: 'fight1', project_id: 'test-project', chapter: 'ch1', label: 'Fight', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'fight1', display_name: 'Goblin', variant_id: 'goblin', sprite_pack: 'enemies', grid_row: 1, grid_col: 5 });

    const status = getBattleRuntimeStatus(db, 'test-project');
    expect(status.party.complete).toBe(1);
    expect(status.party.placeholders).toHaveLength(0);
    expect(status.encounters.total).toBe(1);
    expect(status.encounters.bounds_pass).toBe(1);
    expect(status.portraits.have).toContain('Hero');
    expect(status.portraits.missing).toContain('Goblin');
  });

  it('reports party placeholders correctly', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'noart', project_id: 'test-project', display_name: 'NoArt', role: 'party' });
    upsertVariant(db, { id: 'noart', character_id: 'noart', variant_type: 'base', pack_id: 'party' });
    // No pack files created

    const status = getBattleRuntimeStatus(db, 'test-project');
    expect(status.party.complete).toBe(0);
    expect(status.party.placeholders).toContain('NoArt');
    expect(status.overall_ready).toBe(false);
  });
});

// ─── sync_sprite_pack ────────────────────────────────────────

describe('syncSpritePack', () => {
  it('copies directional sprites into pack structure (5 → 8 dirs)', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'ranger', project_id: 'test-project', display_name: 'Ranger', role: 'party' });
    upsertVariant(db, { id: 'ranger', character_id: 'ranger', variant_type: 'base', pack_id: 'party' });
    buildDirectionalDir(tmpDir, 'ranger');

    const result = syncSpritePack(db, 'test-project', 'ranger', 'ranger', 'party');
    expect(result.files_copied).toBe(8);
    expect(result.receipt.filter(r => r.startsWith('COPY'))).toHaveLength(8);

    // Verify files exist
    const albedoDir = path.join(tmpDir, 'assets', 'sprites', 'party', 'assets', 'ranger', 'albedo');
    for (const dir of DIRECTIONS) {
      expect(fs.existsSync(path.join(albedoDir, `${dir}.png`))).toBe(true);
    }
  });

  it('updates registry after sync', () => {
    seedProject(tmpDir);
    upsertCharacter(db, { id: 'mage', project_id: 'test-project', display_name: 'Mage', role: 'party' });
    upsertVariant(db, { id: 'mage', character_id: 'mage', variant_type: 'base', pack_id: 'party' });
    buildDirectionalDir(tmpDir, 'mage');

    syncSpritePack(db, 'test-project', 'mage', 'mage', 'party');

    const char = db.prepare('SELECT * FROM characters WHERE id = ?').get('mage') as any;
    expect(char.integration_status).toBe('complete');
  });
});
