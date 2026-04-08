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

describe('schema migration v6', () => {
  it('project_templates table exists with template_key unique', () => {
    const cols = db.prepare("PRAGMA table_info('project_templates')").all() as any[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('template_key');
    expect(colNames).toContain('display_name');
    expect(colNames).toContain('engine');
    expect(colNames).toContain('version');

    // Verify UNIQUE on template_key via index
    const indexes = db.prepare("PRAGMA index_list('project_templates')").all() as any[];
    const uniqueIndex = indexes.find((idx: any) => idx.unique === 1);
    expect(uniqueIndex).toBeDefined();
  });

  it('project_bootstraps table exists with bootstrap_mode', () => {
    const cols = db.prepare("PRAGMA table_info('project_bootstraps')").all() as any[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('template_id');
    expect(colNames).toContain('bootstrap_mode');
    expect(colNames).toContain('target_path');
    expect(colNames).toContain('result');

    // bootstrap_mode has default 'combat_first'
    const modeCol = cols.find((c: any) => c.name === 'bootstrap_mode');
    expect(modeCol.dflt_value).toContain('combat_first');
  });

  it('bootstrap_artifacts table exists', () => {
    const cols = db.prepare("PRAGMA table_info('bootstrap_artifacts')").all() as any[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_bootstrap_id');
    expect(colNames).toContain('artifact_type');
    expect(colNames).toContain('path');
    expect(colNames).toContain('content_hash');
  });

  it('template_policies table exists', () => {
    const cols = db.prepare("PRAGMA table_info('template_policies')").all() as any[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('template_id');
    expect(colNames).toContain('policy_key');
    expect(colNames).toContain('policy_json');
  });

  it('schema version is 6', () => {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as any;
    expect(row.version).toBe(6);
  });
});
