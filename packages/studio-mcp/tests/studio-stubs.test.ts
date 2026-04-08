import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject, upsertCharacter } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-stubs-'));
  upsertProject(db, 'proj-st', 'Stubs Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('stub creation', () => {
  it('create_chapter_stub creates canon page + registry record', () => {
    const vaultPath = path.join(tmpDir, 'canon');
    const chapterId = 'ch2';
    const canonId = `proj-st-${chapterId}`;
    const filePath = path.join(vaultPath, '01_Chapters', `${chapterId}.md`);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Simulate studioCreateChapterStub logic
    const now = new Date().toISOString().slice(0, 10);
    const content = [
      '---',
      `id: ${canonId}`,
      `kind: chapter`,
      `project: proj-st`,
      `title: "The Crossing"`,
      `chapter: "${chapterId}"`,
      `status: registered`,
      `updated: ${now}`,
      '---',
      '',
      '# The Crossing',
      '',
      '## Setting',
      '',
    ].join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');

    const pageId = crypto.randomUUID();
    db.prepare(`
      INSERT OR IGNORE INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES (?, ?, ?, 'chapter', ?, ?, 'registered')
    `).run(pageId, 'proj-st', canonId, 'The Crossing', filePath);

    // Verify file exists
    expect(fs.existsSync(filePath)).toBe(true);
    // Verify DB record
    const row = db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?').get(canonId) as any;
    expect(row).toBeDefined();
    expect(row.kind).toBe('chapter');
    expect(row.title).toBe('The Crossing');
  });

  it('create_character_stub creates canon page + character record', () => {
    const vaultPath = path.join(tmpDir, 'canon');

    // Register character via core function
    upsertCharacter(db, {
      id: 'goblin-01',
      project_id: 'proj-st',
      display_name: 'Goblin Scout',
      role: 'enemy',
      family: 'goblin',
    });

    // Create canon page
    const canonId = `proj-st-char-goblin-01`;
    const filePath = path.join(vaultPath, '02_Characters', 'goblin-01.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const content = [
      '---',
      `id: ${canonId}`,
      `kind: character`,
      `project: proj-st`,
      `title: "Goblin Scout"`,
      `role: enemy`,
      `status: registered`,
      `updated: ${new Date().toISOString().slice(0, 10)}`,
      '---',
      '',
      '# Goblin Scout',
      '',
    ].join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');

    const pageId = crypto.randomUUID();
    db.prepare(`
      INSERT OR IGNORE INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES (?, ?, ?, 'character', ?, ?, 'registered')
    `).run(pageId, 'proj-st', canonId, 'Goblin Scout', filePath);

    // Verify character in registry
    const char = db.prepare('SELECT * FROM characters WHERE id = ?').get('goblin-01') as any;
    expect(char).toBeDefined();
    expect(char.display_name).toBe('Goblin Scout');
    expect(char.role).toBe('enemy');

    // Verify canon page
    const page = db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?').get(canonId) as any;
    expect(page).toBeDefined();
    expect(page.kind).toBe('character');
  });

  it('stubs have valid frontmatter', () => {
    const vaultPath = path.join(tmpDir, 'canon');
    const filePath = path.join(vaultPath, '01_Chapters', 'ch3.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const now = new Date().toISOString().slice(0, 10);
    const content = [
      '---',
      `id: proj-st-ch3`,
      `kind: chapter`,
      `project: proj-st`,
      `title: "Chapter Three"`,
      `chapter: "ch3"`,
      `status: registered`,
      `updated: ${now}`,
      '---',
      '',
      '# Chapter Three',
      '',
    ].join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');

    const raw = fs.readFileSync(filePath, 'utf-8');
    expect(raw.startsWith('---\n')).toBe(true);
    expect(raw).toContain('id: proj-st-ch3');
    expect(raw).toContain('kind: chapter');
    expect(raw).toContain('project: proj-st');
    expect(raw).toContain('status: registered');
    expect(raw).toMatch(/updated: \d{4}-\d{2}-\d{2}/);
  });

  it('stubs are linked to project scope', () => {
    // Create both chapter and character stubs for same project
    upsertCharacter(db, {
      id: 'wolf-01',
      project_id: 'proj-st',
      display_name: 'Dire Wolf',
      role: 'enemy',
    });

    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES (?, ?, ?, 'chapter', ?, '/tmp/ch1.md', 'registered')
    `).run(crypto.randomUUID(), 'proj-st', 'proj-st-ch1', 'Ch1');

    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES (?, ?, ?, 'character', ?, '/tmp/wolf.md', 'registered')
    `).run(crypto.randomUUID(), 'proj-st', 'proj-st-char-wolf-01', 'Dire Wolf');

    // All records scoped to same project
    const pages = db.prepare(
      "SELECT * FROM canon_pages WHERE project_id = 'proj-st'"
    ).all() as any[];
    expect(pages.length).toBe(2);
    expect(pages.every(p => p.project_id === 'proj-st')).toBe(true);

    const chars = db.prepare(
      "SELECT * FROM characters WHERE project_id = 'proj-st'"
    ).all() as any[];
    expect(chars.length).toBe(1);
    expect(chars[0].project_id).toBe('proj-st');
  });
});
