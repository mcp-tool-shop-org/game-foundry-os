import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, SCHEMA_VERSION } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

describe('schema migration v4', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  it('proof_suites table exists with is_blocking column', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='proof_suites'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(proof_suites)').all() as { name: string; dflt_value: string | null }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('suite_key');
    expect(colNames).toContain('scope_type');
    expect(colNames).toContain('display_name');
    expect(colNames).toContain('is_blocking');
  });

  it('proof_runs table exists with scope_type and scope_id', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='proof_runs'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(proof_runs)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('suite_id');
    expect(colNames).toContain('scope_type');
    expect(colNames).toContain('scope_id');
    expect(colNames).toContain('result');
    expect(colNames).toContain('blocking_failures');
    expect(colNames).toContain('warning_count');
    expect(colNames).toContain('receipt_hash');
    expect(colNames).toContain('summary');
    expect(colNames).toContain('details_json');
    expect(colNames).toContain('tool_name');
  });

  it('proof_assertions table exists', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='proof_assertions'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(proof_assertions)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('proof_run_id');
    expect(colNames).toContain('assertion_key');
    expect(colNames).toContain('status');
    expect(colNames).toContain('message');
    expect(colNames).toContain('details_json');
  });

  it('freeze_candidates table exists with status column', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='freeze_candidates'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(freeze_candidates)').all() as { name: string; dflt_value: string | null }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('scope_type');
    expect(colNames).toContain('scope_id');
    expect(colNames).toContain('status');
    expect(colNames).toContain('blocking_reasons_json');
    expect(colNames).toContain('warning_reasons_json');
    expect(colNames).toContain('candidate_hash');

    const status = cols.find(c => c.name === 'status');
    expect(status!.dflt_value).toContain('candidate');
  });

  it('freeze_receipts table exists with source_candidate_id', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='freeze_receipts'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(freeze_receipts)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('scope_type');
    expect(colNames).toContain('scope_id');
    expect(colNames).toContain('source_candidate_id');
    expect(colNames).toContain('receipt_hash');
    expect(colNames).toContain('freeze_summary');
    expect(colNames).toContain('details_json');
  });
});
