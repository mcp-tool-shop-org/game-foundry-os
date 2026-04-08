import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  syncVault,
  getPage,
  linkObject,
  getLinks,
  getLinksTo,
  unlinkObject,
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

function makeFrontmatter(fields: Record<string, unknown>, body = ''): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-links-edge-'));
  seedProject();

  // Register two pages
  createVaultFile('char.md', makeFrontmatter({ canon_id: 'char_page', kind: 'character', title: 'Character Page' }));
  createVaultFile('enc.md', makeFrontmatter({ canon_id: 'enc_page', kind: 'encounter', title: 'Encounter Page' }));
  syncVault(db, 'test', tmpDir);

  upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
  upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Encounter 1', grid_rows: 3, grid_cols: 8 });
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('canon links edge cases', () => {
  it('one page can link to multiple targets', () => {
    linkObject(db, { project_id: 'test', source_canon_id: 'char_page', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });
    linkObject(db, { project_id: 'test', source_canon_id: 'char_page', target_type: 'encounter', target_id: 'enc1', link_type: 'tracks' });

    const links = getLinks(db, 'char_page');
    expect(links).toHaveLength(2);
    const types = links.map(l => l.target_type);
    expect(types).toContain('character');
    expect(types).toContain('encounter');
  });

  it('unlinkObject removes only the specified link', () => {
    const link1 = linkObject(db, { project_id: 'test', source_canon_id: 'char_page', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });
    const link2 = linkObject(db, { project_id: 'test', source_canon_id: 'char_page', target_type: 'encounter', target_id: 'enc1', link_type: 'tracks' });

    unlinkObject(db, link1.id);

    const links = getLinks(db, 'char_page');
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe(link2.id);
  });

  it('linking promotes page status from registered to linked', () => {
    const pageBefore = getPage(db, 'char_page');
    expect(pageBefore!.status).toBe('registered');

    linkObject(db, { project_id: 'test', source_canon_id: 'char_page', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    const pageAfter = getPage(db, 'char_page');
    expect(pageAfter!.status).toBe('linked');
  });

  it('getLinksTo returns all pages that link to a target', () => {
    linkObject(db, { project_id: 'test', source_canon_id: 'char_page', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });
    linkObject(db, { project_id: 'test', source_canon_id: 'enc_page', target_type: 'character', target_id: 'skeleton', link_type: 'tracks' });

    const links = getLinksTo(db, 'character', 'skeleton');
    expect(links).toHaveLength(2);
    const canonIds = links.map(l => l.source_canon_id);
    expect(canonIds).toContain('char_page');
    expect(canonIds).toContain('enc_page');
  });
});
