import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase,
  upsertProject,
} from '@mcptoolshop/game-foundry-registry';
import {
  syncVault,
  searchPages,
} from '@mcptoolshop/canon-core';

let db: Database.Database;
let tmpDir: string;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function createVaultFile(relativePath: string, content: string) {
  const fullPath = path.join(tmpDir, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

function makeFrontmatter(fields: Record<string, unknown>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push('---');
  return lines.join('\n');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-search-'));
  seedProject();

  // Register several pages
  createVaultFile('skeleton.md', makeFrontmatter({ canon_id: 'char_skeleton', kind: 'character', title: 'Skeleton Warrior' }));
  createVaultFile('goblin.md', makeFrontmatter({ canon_id: 'char_goblin', kind: 'character', title: 'Goblin Archer' }));
  createVaultFile('forest.md', makeFrontmatter({ canon_id: 'enc_forest', kind: 'encounter', title: 'Forest Ambush' }));
  syncVault(db, 'test', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('canon search', () => {
  it('finds pages by title text', () => {
    const results = searchPages(db, 'test', 'Skeleton');
    expect(results).toHaveLength(1);
    expect(results[0].canon_id).toBe('char_skeleton');
  });

  it('filters by kind', () => {
    const characters = searchPages(db, 'test', '', { kind: 'character' });
    expect(characters).toHaveLength(2);

    const encounters = searchPages(db, 'test', '', { kind: 'encounter' });
    expect(encounters).toHaveLength(1);
    expect(encounters[0].canon_id).toBe('enc_forest');
  });

  it('returns empty for no matches', () => {
    const results = searchPages(db, 'test', 'Nonexistent Dragon');
    expect(results).toHaveLength(0);
  });
});
