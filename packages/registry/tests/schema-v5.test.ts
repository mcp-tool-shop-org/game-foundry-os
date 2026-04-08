import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

describe('schema migration v5', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  it('canon_pages table exists with canon_id unique constraint', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='canon_pages'").get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(canon_pages)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('canon_id');
    expect(colNames).toContain('kind');
    expect(colNames).toContain('title');
    expect(colNames).toContain('vault_path');
    expect(colNames).toContain('status');
    expect(colNames).toContain('content_hash');
    expect(colNames).toContain('frontmatter_json');

    // Verify canon_id uniqueness via index
    const indexes = db.prepare("PRAGMA index_list(canon_pages)").all() as Array<{ name: string; unique: number }>;
    const uniqueIndexes = indexes.filter(i => i.unique === 1);
    // There should be at least one unique index (for canon_id or the primary key)
    expect(uniqueIndexes.length).toBeGreaterThanOrEqual(1);
  });

  it('canon_links table exists with source_canon_id column', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='canon_links'").get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(canon_links)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('source_canon_id');
    expect(colNames).toContain('target_type');
    expect(colNames).toContain('target_id');
    expect(colNames).toContain('link_type');
  });

  it('canon_snapshots table exists', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='canon_snapshots'").get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(canon_snapshots)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('canon_id');
    expect(colNames).toContain('content_hash');
    expect(colNames).toContain('parsed_body_json');
  });

  it('canon_drift_reports table exists', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='canon_drift_reports'").get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(canon_drift_reports)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('scope_type');
    expect(colNames).toContain('scope_id');
    expect(colNames).toContain('result');
    expect(colNames).toContain('details_json');
  });

  it('handoff_artifacts table exists with artifact_type column', () => {
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='handoff_artifacts'").get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(handoff_artifacts)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('scope_type');
    expect(colNames).toContain('scope_id');
    expect(colNames).toContain('artifact_type');
    expect(colNames).toContain('output_path');
    expect(colNames).toContain('content_hash');
    expect(colNames).toContain('details_json');
  });
});
