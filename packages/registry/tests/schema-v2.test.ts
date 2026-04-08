import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

describe('schema migration v2', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  it('creates foundry_batches table', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='foundry_batches'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table!.name).toBe('foundry_batches');

    // Verify key columns exist
    const cols = db.prepare('PRAGMA table_info(foundry_batches)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('variant_id');
    expect(colNames).toContain('batch_type');
    expect(colNames).toContain('direction');
    expect(colNames).toContain('candidate_count');
    expect(colNames).toContain('status');
  });

  it('creates locked_picks table', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='locked_picks'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table!.name).toBe('locked_picks');

    const cols = db.prepare('PRAGMA table_info(locked_picks)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('variant_id');
    expect(colNames).toContain('pick_type');
    expect(colNames).toContain('direction');
    expect(colNames).toContain('locked_artifact_id');
  });

  it('creates artifacts table', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='artifacts'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table!.name).toBe('artifacts');

    const cols = db.prepare('PRAGMA table_info(artifacts)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('project_id');
    expect(colNames).toContain('variant_id');
    expect(colNames).toContain('artifact_type');
    expect(colNames).toContain('is_canonical');
    expect(colNames).toContain('content_hash');
  });

  it('creates state_events table', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='state_events'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();
    expect(table!.name).toBe('state_events');

    const cols = db.prepare('PRAGMA table_info(state_events)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('entity_type');
    expect(colNames).toContain('entity_id');
    expect(colNames).toContain('from_state');
    expect(colNames).toContain('to_state');
    expect(colNames).toContain('payload_json');
  });

  it('variants table has production_state column defaulting to draft', () => {
    const cols = db.prepare('PRAGMA table_info(variants)').all() as { name: string; dflt_value: string | null }[];
    const prodState = cols.find(c => c.name === 'production_state');
    expect(prodState).toBeDefined();
    expect(prodState!.dflt_value).toContain('draft');

    const portraitState = cols.find(c => c.name === 'portrait_state');
    expect(portraitState).toBeDefined();
    expect(portraitState!.dflt_value).toContain('none');
  });
});
