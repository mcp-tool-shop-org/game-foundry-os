import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
} from '@mcptoolshop/game-foundry-registry';
import { verifyRuntimePaths } from '../src/tools/verifyRuntimePaths.js';
import type Database from 'better-sqlite3';

const DIRECTIONS = ['front', 'front_left', 'left', 'back_left', 'back', 'back_right', 'right', 'front_right'];

let db: Database.Database;
let tmpDir: string;

function buildPackDir(root: string, pack: string, variant: string, dirCount: number, withImports: boolean): string {
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

function buildPortrait(root: string, name: string): void {
  const dir = path.join(root, 'assets', 'portraits', 'gate_test');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name.toLowerCase()}_80x80.png`), 'fake');
  fs.writeFileSync(path.join(dir, `${name.toLowerCase()}_28x28.png`), 'fake');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-edge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('verifyRuntimePaths edge cases', () => {
  it('throws for nonexistent project_id', () => {
    expect(() => verifyRuntimePaths(db, 'nonexistent'))
      .toThrow('Project not found');
  });

  it('handles character with no variants gracefully', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertCharacter(db, { id: 'lonely', project_id: 'test', display_name: 'Lonely', role: 'enemy' });
    // No variants registered

    const result = verifyRuntimePaths(db, 'test');
    expect(result.pass).toBe(true);
    expect(result.characters).toHaveLength(0);
  });

  it('skips portrait-type variants', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'hero', project_id: 'test', display_name: 'Hero', role: 'party' });
    upsertVariant(db, { id: 'hero-portrait', character_id: 'hero', variant_type: 'portrait' });
    upsertVariant(db, { id: 'hero-base', character_id: 'hero', variant_type: 'base', pack_id: 'enemies' });
    buildPackDir(tmpDir, 'enemies', 'hero-base', 8, true);

    const result = verifyRuntimePaths(db, 'test');
    // Should only include the base variant, not the portrait
    expect(result.characters).toHaveLength(1);
    expect(result.characters[0].variant_id).toBe('hero-base');
  });

  it('reports missing .import files separately from missing PNGs', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'grunt', project_id: 'test', display_name: 'Grunt', role: 'enemy' });
    // Set pack_dir so verifyRuntimePaths resolves the correct albedo directory
    upsertVariant(db, {
      id: 'grunt', character_id: 'grunt', variant_type: 'base', pack_id: 'enemies',
      pack_dir: 'assets/sprites/enemies/assets/grunt/albedo',
    });
    // 8 PNGs but NO .import files
    buildPackDir(tmpDir, 'enemies', 'grunt', 8, false);

    const result = verifyRuntimePaths(db, 'test');
    expect(result.pass).toBe(false);
    expect(result.failures[0]).toContain('.import');
    expect(result.characters[0].albedo_count).toBe(8);
    expect(result.characters[0].import_count).toBe(0);
  });

  it('detects portrait presence for characters that have portraits', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'party', project_id: 'test', pack_type: 'party', root_path: 'assets/sprites/party' });
    upsertCharacter(db, { id: 'maren', project_id: 'test', display_name: 'Maren', role: 'party' });
    upsertVariant(db, { id: 'maren', character_id: 'maren', variant_type: 'base', pack_id: 'party' });
    buildPackDir(tmpDir, 'party', 'maren', 8, true);
    buildPortrait(tmpDir, 'Maren');

    const result = verifyRuntimePaths(db, 'test');
    expect(result.characters[0].portrait_exists).toBe(true);
  });
});
