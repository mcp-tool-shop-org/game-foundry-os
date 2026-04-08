import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('schema migration v8 — adoption + quality spine', () => {
  it('schema version is 8', () => {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as any;
    expect(row.version).toBeGreaterThanOrEqual(8);
  });

  it('repair_plans has approval_status column with default not_required', () => {
    const cols = db.prepare("PRAGMA table_info('repair_plans')").all() as any[];
    const col = cols.find((c: any) => c.name === 'approval_status');
    expect(col).toBeDefined();
    expect(col.dflt_value).toContain('not_required');
  });

  it('repair_plans has approved_by and approved_at columns', () => {
    const cols = db.prepare("PRAGMA table_info('repair_plans')").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('approved_by');
    expect(colNames).toContain('approved_at');
  });

  it('repair_plans has risk_class column with default safe_auto', () => {
    const cols = db.prepare("PRAGMA table_info('repair_plans')").all() as any[];
    const col = cols.find((c: any) => c.name === 'risk_class');
    expect(col).toBeDefined();
    expect(col.dflt_value).toContain('safe_auto');
  });

  it('quality_domain_states table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('quality_domain_states')").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('domain');
    expect(colNames).toContain('status');
    expect(colNames).toContain('blocker_count');
    expect(colNames).toContain('warning_count');
    expect(colNames).toContain('finding_ids_json');
    expect(colNames).toContain('next_action');
    expect(colNames).toContain('computed_at');
  });

  it('adoption_plans table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('adoption_plans')").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('profile');
    expect(colNames).toContain('current_stage');
    expect(colNames).toContain('stages_json');
    expect(colNames).toContain('completion_json');
  });

  it('quality_domain_states CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare(`
      INSERT INTO quality_domain_states (id, project_id, domain, status, blocker_count, warning_count)
      VALUES ('qd_1', 'p1', 'runtime_integrity', 'blocked', 2, 1)
    `).run();

    const row = db.prepare('SELECT * FROM quality_domain_states WHERE id = ?').get('qd_1') as any;
    expect(row.domain).toBe('runtime_integrity');
    expect(row.status).toBe('blocked');
    expect(row.blocker_count).toBe(2);
  });

  it('adoption_plans CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare(`
      INSERT INTO adoption_plans (id, project_id, profile, stages_json)
      VALUES ('ap_1', 'p1', 'retrofit_prototype', '[]')
    `).run();

    const row = db.prepare('SELECT * FROM adoption_plans WHERE id = ?').get('ap_1') as any;
    expect(row.profile).toBe('retrofit_prototype');
    expect(row.current_stage).toBe(1);
  });
});
