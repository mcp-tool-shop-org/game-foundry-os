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

describe('schema migration v7 — repair closure spine', () => {
  it('schema version is 7', () => {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as any;
    expect(row.version).toBeGreaterThanOrEqual(7);
  });

  it('repair_plans table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('repair_plans')").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('finding_ids_json');
    expect(colNames).toContain('action_key');
    expect(colNames).toContain('target');
    expect(colNames).toContain('mode');
    expect(colNames).toContain('plan_fingerprint');
    expect(colNames).toContain('steps_json');
    expect(colNames).toContain('expected_effects_json');
    expect(colNames).toContain('preconditions_json');
    expect(colNames).toContain('status');
    expect(colNames).toContain('created_at');

    // Default status is 'planned'
    const statusCol = cols.find((c: any) => c.name === 'status');
    expect(statusCol.dflt_value).toContain('planned');
  });

  it('repair_receipts table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('repair_receipts')").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('plan_id');
    expect(colNames).toContain('action_key');
    expect(colNames).toContain('mode');
    expect(colNames).toContain('before_json');
    expect(colNames).toContain('after_json');
    expect(colNames).toContain('changed_targets_json');
    expect(colNames).toContain('step_results_json');
    expect(colNames).toContain('verification_json');
    expect(colNames).toContain('status_delta_json');
    expect(colNames).toContain('receipt_hash');
    expect(colNames).toContain('status');
    expect(colNames).toContain('created_at');
  });

  it('repair_regressions table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('repair_regressions')").all() as any[];
    const colNames = cols.map((c: any) => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('receipt_id');
    expect(colNames).toContain('regression_type');
    expect(colNames).toContain('severity');
    expect(colNames).toContain('details_json');
    expect(colNames).toContain('created_at');
  });

  it('repair_plans CRUD works', () => {
    // Seed a project
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();

    db.prepare(`
      INSERT INTO repair_plans (id, project_id, finding_ids_json, action_key, target, plan_fingerprint, steps_json, status)
      VALUES ('rp_1', 'p1', '["shell_battle_scene"]', 'studio_install_runtime_shell', '/tmp', 'fp_abc', '[]', 'planned')
    `).run();

    const row = db.prepare('SELECT * FROM repair_plans WHERE id = ?').get('rp_1') as any;
    expect(row).toBeDefined();
    expect(row.action_key).toBe('studio_install_runtime_shell');
    expect(row.status).toBe('planned');
    expect(JSON.parse(row.finding_ids_json)).toEqual(['shell_battle_scene']);

    // Update status
    db.prepare("UPDATE repair_plans SET status = 'applied' WHERE id = 'rp_1'").run();
    const updated = db.prepare('SELECT status FROM repair_plans WHERE id = ?').get('rp_1') as any;
    expect(updated.status).toBe('applied');
  });

  it('repair_receipts and repair_regressions reference repair_plans', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare(`
      INSERT INTO repair_plans (id, project_id, finding_ids_json, action_key, target, plan_fingerprint, steps_json)
      VALUES ('rp_1', 'p1', '[]', 'studio_install_runtime_shell', '/tmp', 'fp_abc', '[]')
    `).run();

    // Insert receipt
    db.prepare(`
      INSERT INTO repair_receipts (id, project_id, plan_id, action_key, mode, step_results_json, receipt_hash, status)
      VALUES ('rr_1', 'p1', 'rp_1', 'studio_install_runtime_shell', 'apply', '[]', 'hash_1', 'pass')
    `).run();

    const receipt = db.prepare('SELECT * FROM repair_receipts WHERE id = ?').get('rr_1') as any;
    expect(receipt.plan_id).toBe('rp_1');
    expect(receipt.status).toBe('pass');

    // Insert regression
    db.prepare(`
      INSERT INTO repair_regressions (id, project_id, receipt_id, regression_type, severity)
      VALUES ('rreg_1', 'p1', 'rr_1', 'new_blocker', 'major')
    `).run();

    const reg = db.prepare('SELECT * FROM repair_regressions WHERE id = ?').get('rreg_1') as any;
    expect(reg.receipt_id).toBe('rr_1');
    expect(reg.severity).toBe('major');
  });
});
