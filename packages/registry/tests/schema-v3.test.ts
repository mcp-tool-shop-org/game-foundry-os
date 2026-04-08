import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, SCHEMA_VERSION } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

describe('schema migration v3', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  it('schema version is at least 3', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(3);
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as { version: number };
    expect(row.version).toBeGreaterThanOrEqual(3);
  });

  it('encounters table has production_state column', () => {
    const cols = db.prepare('PRAGMA table_info(encounters)').all() as { name: string; dflt_value: string | null }[];
    const prodState = cols.find(c => c.name === 'production_state');
    expect(prodState).toBeDefined();
    expect(prodState!.dflt_value).toContain('draft');
  });

  it('encounters table has encounter_type column defaulting to standard', () => {
    const cols = db.prepare('PRAGMA table_info(encounters)').all() as { name: string; dflt_value: string | null }[];
    const encType = cols.find(c => c.name === 'encounter_type');
    expect(encType).toBeDefined();
    expect(encType!.dflt_value).toContain('standard');
  });

  it('encounter_enemies table has role_tag and team columns', () => {
    const cols = db.prepare('PRAGMA table_info(encounter_enemies)').all() as { name: string; dflt_value: string | null }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('role_tag');
    expect(colNames).toContain('team');
    expect(colNames).toContain('spawn_group');
    expect(colNames).toContain('facing');
    expect(colNames).toContain('engine_profile_json');
    expect(colNames).toContain('character_id');

    const team = cols.find(c => c.name === 'team');
    expect(team!.dflt_value).toContain('enemy');
  });

  it('encounter_rules table exists with rule_type and rule_key columns', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='encounter_rules'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(encounter_rules)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('encounter_id');
    expect(colNames).toContain('rule_type');
    expect(colNames).toContain('rule_key');
    expect(colNames).toContain('rule_payload_json');
  });

  it('encounter_validation_runs table exists', () => {
    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='encounter_validation_runs'",
    ).get() as { name: string } | undefined;
    expect(table).toBeDefined();

    const cols = db.prepare('PRAGMA table_info(encounter_validation_runs)').all() as { name: string }[];
    const colNames = cols.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('encounter_id');
    expect(colNames).toContain('validation_type');
    expect(colNames).toContain('result');
    expect(colNames).toContain('details_json');

    // Also check encounter_exports and encounter_sync_receipts
    const exports = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='encounter_exports'",
    ).get() as { name: string } | undefined;
    expect(exports).toBeDefined();

    const syncs = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='encounter_sync_receipts'",
    ).get() as { name: string } | undefined;
    expect(syncs).toBeDefined();
  });
});
