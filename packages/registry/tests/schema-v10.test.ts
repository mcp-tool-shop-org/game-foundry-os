import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, SCHEMA_VERSION } from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('schema v10 — chapter spine tables', () => {
  it('schema version is at least 10', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(10);
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as any;
    expect(row.v).toBeGreaterThanOrEqual(10);
  });

  it('chapters table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('chapters')").all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('project_id');
    expect(names).toContain('display_name');
    expect(names).toContain('sort_order');
    expect(names).toContain('intent_summary');
    expect(names).toContain('required_encounter_count');
    expect(names).toContain('required_playtest_pass');
    expect(names).toContain('production_state');
  });

  it('chapter_health_snapshots table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('chapter_health_snapshots')").all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('chapter_id');
    expect(names).toContain('overall_status');
    expect(names).toContain('weakest_domain');
    expect(names).toContain('blocker_summary');
    expect(names).toContain('encounter_coverage_json');
    expect(names).toContain('domain_scores_json');
    expect(names).toContain('next_action');
    expect(names).toContain('next_action_target');
  });

  it('chapters CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare("INSERT INTO chapters (id, project_id, display_name, sort_order) VALUES ('ch1', 'p1', 'Chapter 1', 1)").run();

    const row = db.prepare('SELECT * FROM chapters WHERE id = ?').get('ch1') as any;
    expect(row.project_id).toBe('p1');
    expect(row.display_name).toBe('Chapter 1');
    expect(row.sort_order).toBe(1);
    expect(row.production_state).toBe('draft');
  });

  it('chapter_health_snapshots CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare("INSERT INTO chapters (id, project_id, display_name) VALUES ('ch1', 'p1', 'Ch1')").run();
    db.prepare(`
      INSERT INTO chapter_health_snapshots (id, chapter_id, project_id, overall_status, blocker_summary)
      VALUES ('hs1', 'ch1', 'p1', 'blocked', 'Raider Ambush has no scene contract')
    `).run();

    const row = db.prepare('SELECT * FROM chapter_health_snapshots WHERE id = ?').get('hs1') as any;
    expect(row.overall_status).toBe('blocked');
    expect(row.blocker_summary).toBe('Raider Ambush has no scene contract');
  });

  it('chapter indexes exist', () => {
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_chapter%'").all() as any[];
    const names = indexes.map((i: any) => i.name);
    expect(names).toContain('idx_chapters_project');
    expect(names).toContain('idx_chapters_sort');
    expect(names).toContain('idx_chapter_health_chapter');
  });
});
