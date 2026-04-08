import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { seedVault } from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-vault-edge-'));
  upsertProject(db, 'proj-sv', 'Seed Vault Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('seed vault edge cases', () => {
  it('all seeded pages have valid frontmatter with required fields', () => {
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'proj-sv', vaultPath, 'combat_first');

    const files = collectMdFiles(vaultPath);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).toContain('---');
      expect(content).toMatch(/^---\n/);
      expect(content).toMatch(/\nid: /);
      expect(content).toMatch(/\nkind: /);
      expect(content).toMatch(/\nproject: proj-sv/);
      expect(content).toMatch(/\ntitle: "/);
      expect(content).toMatch(/\nstatus: registered/);
      expect(content).toMatch(/\nupdated: \d{4}-\d{2}-\d{2}/);
    }
  });

  it('combat_first mode creates encounter-patterns.md', () => {
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'proj-sv', vaultPath, 'combat_first');

    const encounterPatterns = path.join(vaultPath, '04_Combat', 'encounter-patterns.md');
    expect(fs.existsSync(encounterPatterns)).toBe(true);

    const content = fs.readFileSync(encounterPatterns, 'utf-8');
    expect(content).toContain('kind: combat_doctrine');
    expect(content).toContain('Encounter Patterns');
  });

  it('story_first mode does not create encounter-patterns.md', () => {
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'proj-sv', vaultPath, 'story_first');

    const encounterPatterns = path.join(vaultPath, '04_Combat', 'encounter-patterns.md');
    expect(fs.existsSync(encounterPatterns)).toBe(false);
  });

  it('vault pages have correct kind fields', () => {
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'proj-sv', vaultPath, 'combat_first');

    const vision = fs.readFileSync(path.join(vaultPath, '00_Project', 'vision.md'), 'utf-8');
    expect(vision).toMatch(/\nkind: project/);

    const ch1 = fs.readFileSync(path.join(vaultPath, '01_Chapters', 'ch1.md'), 'utf-8');
    expect(ch1).toMatch(/\nkind: chapter/);

    const combatDoctrine = fs.readFileSync(path.join(vaultPath, '04_Combat', 'combat-doctrine.md'), 'utf-8');
    expect(combatDoctrine).toMatch(/\nkind: combat_doctrine/);

    const artDoctrine = fs.readFileSync(path.join(vaultPath, '05_Art', 'art-doctrine.md'), 'utf-8');
    expect(artDoctrine).toMatch(/\nkind: art_doctrine/);
  });

  it('repeated seeding does not duplicate pages', () => {
    const vaultPath = path.join(tmpDir, 'canon');
    const first = seedVault(db, 'proj-sv', vaultPath, 'combat_first');
    const second = seedVault(db, 'proj-sv', vaultPath, 'combat_first');

    // Same number of pages — files are overwritten, not duplicated
    expect(second.pages_created).toBe(first.pages_created);

    const files = collectMdFiles(vaultPath);
    expect(files.length).toBe(first.pages_created);
  });
});

function collectMdFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}
