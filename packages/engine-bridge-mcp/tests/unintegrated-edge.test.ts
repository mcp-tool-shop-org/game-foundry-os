import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant,
  upsertPack, setProductionState,
} from '@mcptoolshop/game-foundry-registry';
import { reportUnintegrated } from '../src/tools/reportUnintegrated.js';
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

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'unintegrated-edge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('reportUnintegrated edge cases', () => {
  it('throws for nonexistent project_id', () => {
    expect(() => reportUnintegrated(db, 'nonexistent'))
      .toThrow('Project not found');
  });

  it('ignores characters where pack_status is not complete', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'wip', project_id: 'test', display_name: 'WIP', role: 'enemy' });
    // pack_status defaults to 'none' — should be skipped
    upsertVariant(db, { id: 'wip', character_id: 'wip', variant_type: 'base', pack_id: 'enemies' });

    const result = reportUnintegrated(db, 'test');
    expect(result.count).toBe(0);
  });

  it('reports multiple simultaneous gaps (PNGs + imports + integration_status)', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'broken', project_id: 'test', display_name: 'Broken', role: 'enemy' });
    setProductionState(db, 'broken', 'pack_status', 'complete');
    // integration_status stays 'none'
    upsertVariant(db, { id: 'broken', character_id: 'broken', variant_type: 'base', pack_id: 'enemies' });
    // Only 3 PNGs, no imports
    buildPackDir(tmpDir, 'enemies', 'broken', 3, false);

    const result = reportUnintegrated(db, 'test');
    expect(result.count).toBe(1);
    const gap = result.unintegrated[0].gap;
    expect(gap).toContain('3/8 PNGs');
    expect(gap).toContain('.import');
    expect(gap).toContain('integration_status');
  });

  it('reports variant with pack_status=complete but no pack_id assigned', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertCharacter(db, { id: 'nopak', project_id: 'test', display_name: 'NoPak', role: 'enemy' });
    setProductionState(db, 'nopak', 'pack_status', 'complete');
    upsertVariant(db, { id: 'nopak', character_id: 'nopak', variant_type: 'base' });
    // No pack_id on variant

    const result = reportUnintegrated(db, 'test');
    expect(result.count).toBe(1);
    expect(result.unintegrated[0].gap).toContain('no pack assignment');
  });
});
