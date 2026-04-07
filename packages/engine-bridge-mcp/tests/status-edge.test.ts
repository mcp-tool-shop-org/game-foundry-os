import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant,
  upsertPack, upsertEncounter, addEnemy,
} from '@mcptoolshop/game-foundry-registry';
import { getBattleRuntimeStatus } from '../src/tools/getBattleRuntimeStatus.js';
import type Database from 'better-sqlite3';

const DIRECTIONS = ['front', 'front_left', 'left', 'back_left', 'back', 'back_right', 'right', 'front_right'];

let db: Database.Database;
let tmpDir: string;

function buildPackDir(root: string, pack: string, variant: string, dirCount: number, withImports: boolean): void {
  const albedoDir = path.join(root, 'assets', 'sprites', pack, 'assets', variant, 'albedo');
  fs.mkdirSync(albedoDir, { recursive: true });
  for (let i = 0; i < dirCount && i < DIRECTIONS.length; i++) {
    fs.writeFileSync(path.join(albedoDir, `${DIRECTIONS[i]}.png`), 'fake');
    if (withImports) {
      fs.writeFileSync(path.join(albedoDir, `${DIRECTIONS[i]}.png.import`), 'fake');
    }
  }
}

function buildPortrait(root: string, name: string): void {
  const dir = path.join(root, 'assets', 'portraits', 'gate_test');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name.toLowerCase()}_80x80.png`), 'fake');
  fs.writeFileSync(path.join(dir, `${name.toLowerCase()}_28x28.png`), 'fake');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-edge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getBattleRuntimeStatus edge cases', () => {
  it('throws for nonexistent project_id', () => {
    expect(() => getBattleRuntimeStatus(db, 'nonexistent'))
      .toThrow('Project not found');
  });

  it('empty project returns zero counts and overall_ready=true', () => {
    upsertProject(db, 'empty', 'Empty', tmpDir);

    const status = getBattleRuntimeStatus(db, 'empty');
    expect(status.party.total).toBe(0);
    expect(status.party.complete).toBe(0);
    expect(status.party.placeholders).toHaveLength(0);
    expect(status.encounters.total).toBe(0);
    expect(status.boss_phases).toHaveLength(0);
    expect(status.overall_ready).toBe(true);
  });

  it('boss with phase1 and phase2 both on disk reports both ok', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'avar', project_id: 'test', display_name: 'Avar', role: 'boss' });
    upsertVariant(db, { id: 'avar_armed', character_id: 'avar', variant_type: 'base', pack_id: 'enemies', phase: 1 });
    upsertVariant(db, { id: 'avar_desperate', character_id: 'avar', variant_type: 'phase2', pack_id: 'enemies', phase: 2 });
    buildPackDir(tmpDir, 'enemies', 'avar_armed', 8, true);
    buildPackDir(tmpDir, 'enemies', 'avar_desperate', 8, true);

    const status = getBattleRuntimeStatus(db, 'test');
    expect(status.boss_phases).toHaveLength(1);
    expect(status.boss_phases[0].phase1_ok).toBe(true);
    expect(status.boss_phases[0].phase2_ok).toBe(true);
  });

  it('boss with phase1 ok but phase2 missing reports phase2_ok=false', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'avar', project_id: 'test', display_name: 'Avar', role: 'boss' });
    upsertVariant(db, { id: 'avar_armed', character_id: 'avar', variant_type: 'base', pack_id: 'enemies', phase: 1 });
    upsertVariant(db, { id: 'avar_desperate', character_id: 'avar', variant_type: 'phase2', pack_id: 'enemies', phase: 2 });
    buildPackDir(tmpDir, 'enemies', 'avar_armed', 8, true);
    // phase2 has NO files on disk

    const status = getBattleRuntimeStatus(db, 'test');
    expect(status.boss_phases[0].phase1_ok).toBe(true);
    expect(status.boss_phases[0].phase2_ok).toBe(false);
  });

  it('overall_ready is false when any encounter fails bounds validation', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'goblin', project_id: 'test', display_name: 'Goblin', role: 'enemy' });
    upsertVariant(db, { id: 'goblin', character_id: 'goblin', variant_type: 'base', pack_id: 'enemies' });

    // Encounter with out-of-bounds enemy
    upsertEncounter(db, { id: 'bad', project_id: 'test', chapter: 'ch1', label: 'Bad', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'bad', display_name: 'Goblin', variant_id: 'goblin', sprite_pack: 'enemies', grid_row: 5, grid_col: 0 });

    const status = getBattleRuntimeStatus(db, 'test');
    expect(status.encounters.bounds_pass).toBe(0);
    expect(status.overall_ready).toBe(false);
  });

  it('portraits.missing includes enemy characters too', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'maren', project_id: 'test', display_name: 'Maren', role: 'party' });
    upsertCharacter(db, { id: 'goblin', project_id: 'test', display_name: 'Goblin', role: 'enemy' });
    buildPortrait(tmpDir, 'Maren');
    // Goblin has no portrait

    const status = getBattleRuntimeStatus(db, 'test');
    expect(status.portraits.have).toContain('Maren');
    expect(status.portraits.missing).toContain('Goblin');
  });
});
