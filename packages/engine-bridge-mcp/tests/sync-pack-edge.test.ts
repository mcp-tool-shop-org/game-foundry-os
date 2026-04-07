import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
} from '@mcptoolshop/game-foundry-registry';
import { syncSpritePack } from '../src/tools/syncSpritePack.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-pack-edge-'));
  upsertProject(db, 'test', 'Test', tmpDir);
  upsertPack(db, { id: 'party', project_id: 'test', pack_type: 'party', root_path: 'assets/sprites/party' });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function buildDirectionalDir(root: string, charId: string, dirs?: string[]): void {
  const allDirs = dirs || ['front', 'front_34', 'side', 'back_34', 'back'];
  for (const d of allDirs) {
    const dirPath = path.join(root, 'assets', 'sprites', 'directional', charId, d);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(path.join(dirPath, `${charId}_${d}_01.png`), 'fake');
  }
}

describe('syncSpritePack edge cases', () => {
  it('throws when project not found', () => {
    expect(() => syncSpritePack(db, 'nonexistent', 'char', 'var', 'pack'))
      .toThrow('Project not found');
  });

  it('throws when character not found', () => {
    expect(() => syncSpritePack(db, 'test', 'nonexistent', 'var', 'pack'))
      .toThrow('Character not found');
  });

  it('throws when variant not found', () => {
    upsertCharacter(db, { id: 'ranger', project_id: 'test', display_name: 'Ranger', role: 'party' });
    expect(() => syncSpritePack(db, 'test', 'ranger', 'nonexistent', 'party'))
      .toThrow('Variant not found');
  });

  it('throws when directional source directory does not exist', () => {
    upsertCharacter(db, { id: 'ranger', project_id: 'test', display_name: 'Ranger', role: 'party' });
    upsertVariant(db, { id: 'ranger', character_id: 'ranger', variant_type: 'base', pack_id: 'party' });
    // No directional dirs created on disk

    expect(() => syncSpritePack(db, 'test', 'ranger', 'ranger', 'party'))
      .toThrow('Directional source not found');
  });

  it('skips foundry dirs that have no PNGs and adds SKIP to receipt', () => {
    upsertCharacter(db, { id: 'ranger', project_id: 'test', display_name: 'Ranger', role: 'party' });
    upsertVariant(db, { id: 'ranger', character_id: 'ranger', variant_type: 'base', pack_id: 'party' });

    // Create only 3 of 5 foundry dirs with PNGs
    buildDirectionalDir(tmpDir, 'ranger', ['front', 'front_34', 'side']);
    // Create back_34 dir but with no PNGs
    const emptyDir = path.join(tmpDir, 'assets', 'sprites', 'directional', 'ranger', 'back_34');
    fs.mkdirSync(emptyDir, { recursive: true });
    // Don't create 'back' dir at all

    const result = syncSpritePack(db, 'test', 'ranger', 'ranger', 'party');

    const skips = result.receipt.filter(r => r.startsWith('SKIP'));
    expect(skips.length).toBe(2); // back_34 (no PNGs) + back (not found)
    expect(skips.some(s => s.includes('back_34') && s.includes('no PNGs'))).toBe(true);
    expect(skips.some(s => s.includes('back') && s.includes('not found'))).toBe(true);

    // front(1) + front_34(2) + side(2) = 5 files copied
    expect(result.files_copied).toBe(5);
  });
});
