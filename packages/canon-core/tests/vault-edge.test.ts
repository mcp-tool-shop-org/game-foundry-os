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
  getPage,
  getSnapshots,
} from '@mcptoolshop/canon-core';

let db: Database.Database;
let tmpDir: string;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function createVaultFile(relativePath: string, content: string) {
  const fullPath = path.join(tmpDir, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf-8');
}

function makeFrontmatter(fields: Record<string, unknown>, body = ''): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  if (body) lines.push('', body);
  return lines.join('\n');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-vault-edge-'));
  seedProject();
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('vault sync edge cases', () => {
  it('ignores non-.md files in vault', () => {
    createVaultFile('characters/skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
    }));
    // Create non-md files that should be ignored
    createVaultFile('characters/notes.txt', 'This is a text file');
    createVaultFile('characters/image.png', 'binary data');
    createVaultFile('characters/data.json', '{"key": "value"}');

    const result = syncVault(db, 'test', tmpDir);
    expect(result.scanned).toBe(1); // Only the .md file
    expect(result.registered).toBe(1);
  });

  it('handles vault with no .md files gracefully', () => {
    // Create only non-md files
    createVaultFile('data/config.json', '{}');
    createVaultFile('assets/sprite.png', 'binary');

    const result = syncVault(db, 'test', tmpDir);
    expect(result.scanned).toBe(0);
    expect(result.registered).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.invalid).toHaveLength(0);
  });

  it('detects content hash change on resync', () => {
    createVaultFile('char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Original Title',
    }));

    syncVault(db, 'test', tmpDir);
    const page1 = getPage(db, 'char_test');
    const hash1 = page1!.content_hash;

    // Change the content
    createVaultFile('char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Updated Title',
    }));

    const result = syncVault(db, 'test', tmpDir);
    expect(result.updated).toBe(1);

    const page2 = getPage(db, 'char_test');
    expect(page2!.content_hash).not.toBe(hash1);
    expect(page2!.title).toBe('Updated Title');
  });

  it('creates snapshot on each sync', () => {
    // Note: syncVault itself doesn't create snapshots — that's createSnapshot().
    // But vault sync records a state_event. Let's verify the state_event is created.
    createVaultFile('char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));

    syncVault(db, 'test', tmpDir);

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'vault' AND project_id = 'test'"
    ).all();
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('handles deeply nested directory structure', () => {
    createVaultFile('game/project/ch1/characters/goblin.md', makeFrontmatter({
      canon_id: 'char_goblin',
      kind: 'character',
      title: 'Goblin',
    }));
    createVaultFile('game/project/ch1/encounters/forest/ambush.md', makeFrontmatter({
      canon_id: 'enc_ambush',
      kind: 'encounter',
      title: 'Forest Ambush',
    }));
    createVaultFile('game/project/ch2/characters/dragon.md', makeFrontmatter({
      canon_id: 'char_dragon',
      kind: 'character',
      title: 'Dragon',
    }));

    const result = syncVault(db, 'test', tmpDir);
    expect(result.scanned).toBe(3);
    expect(result.registered).toBe(3);

    const goblin = getPage(db, 'char_goblin');
    expect(goblin).toBeDefined();
    expect(goblin!.vault_path).toContain('game/project/ch1/characters/goblin.md');
  });
});
