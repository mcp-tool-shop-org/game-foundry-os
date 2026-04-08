import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  seedProjectRegistry,
  registerDefaultTemplates,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'proj-tp', 'Template Policies Project', '/tmp/tp');
});

afterEach(() => {
  db.close();
});

describe('template policies', () => {
  it('default template has blocking placeholder policy', () => {
    seedProjectRegistry(db, 'proj-tp', 'godot-tactics-template');

    const suites = db.prepare(
      "SELECT * FROM proof_suites WHERE project_id = 'proj-tp' AND suite_key = 'asset_integrity'"
    ).get() as any;
    expect(suites).toBeDefined();
    expect(suites.is_blocking).toBe(1);
  });

  it('default template has blocking runtime integrity policy', () => {
    seedProjectRegistry(db, 'proj-tp', 'godot-tactics-template');

    const suite = db.prepare(
      "SELECT * FROM proof_suites WHERE project_id = 'proj-tp' AND suite_key = 'runtime_integrity'"
    ).get() as any;
    expect(suite).toBeDefined();
    expect(suite.is_blocking).toBe(1);
  });

  it('default template has warning-only portrait policy', () => {
    seedProjectRegistry(db, 'proj-tp', 'godot-tactics-template');

    const suite = db.prepare(
      "SELECT * FROM proof_suites WHERE project_id = 'proj-tp' AND suite_key = 'presentation'"
    ).get() as any;
    expect(suite).toBeDefined();
    expect(suite.is_blocking).toBe(0);
  });

  it('policies stored correctly in freeze_policies table', () => {
    seedProjectRegistry(db, 'proj-tp', 'godot-tactics-template');

    const policies = db.prepare(
      "SELECT * FROM freeze_policies WHERE project_id = 'proj-tp'"
    ).all() as any[];
    expect(policies.length).toBe(3);

    const variantPolicy = policies.find(p => p.policy_key === 'variant_freeze');
    expect(variantPolicy).toBeDefined();
    const parsed = JSON.parse(variantPolicy.policy_json);
    expect(parsed.require_proof_pass).toBe(true);
    expect(parsed.require_engine_sync).toBe(true);
    expect(parsed.require_portrait).toBe(false);

    const encounterPolicy = policies.find(p => p.policy_key === 'encounter_freeze');
    expect(encounterPolicy).toBeDefined();

    const chapterPolicy = policies.find(p => p.policy_key === 'chapter_freeze');
    expect(chapterPolicy).toBeDefined();
    const chapterParsed = JSON.parse(chapterPolicy.policy_json);
    expect(chapterParsed.require_all_encounters_frozen).toBe(true);
  });
});
