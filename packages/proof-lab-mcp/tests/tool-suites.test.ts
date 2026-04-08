import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  runAssetSuite,
  runEncounterSuite,
  getAssertions,
  getFreezeReadiness,
  createFreezeCandidate,
  promoteFreeze,
  getProofNextStep,
} from '@mcptoolshop/proof-lab-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function seedVariant(varId: string, opts?: { packPresent?: number; dirsPresent?: number; prodState?: string }) {
  upsertCharacter(db, { id: `char_${varId}`, project_id: 'test', display_name: `Char ${varId}` });
  db.prepare('UPDATE characters SET chapter_primary = ? WHERE id = ?').run('ch1', `char_${varId}`);
  upsertVariant(db, { id: varId, character_id: `char_${varId}`, variant_type: 'base' });

  const sets: string[] = [];
  if (opts?.packPresent !== undefined) sets.push(`pack_present = ${opts.packPresent}`);
  if (opts?.dirsPresent !== undefined) sets.push(`directions_present = ${opts.dirsPresent}`);
  if (opts?.prodState) sets.push(`production_state = '${opts.prodState}'`);
  if (sets.length > 0) {
    db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(varId);
  }
}

function seedEncounter(id: string, chapter: string) {
  upsertEncounter(db, { id, project_id: 'test', chapter, label: `Encounter ${id}`, grid_rows: 3, grid_cols: 8 });
  db.prepare("UPDATE encounters SET display_name = ?, encounter_type = 'standard' WHERE id = ?").run(`Encounter ${id}`, id);
}

function insertValidationRun(encounterId: string, validationType: string, result: string) {
  db.prepare(`INSERT INTO encounter_validation_runs (encounter_id, validation_type, result) VALUES (?, ?, ?)`).run(encounterId, validationType, result);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('proof MCP tool operations', () => {
  it('proof_run_asset_suite creates run with assertions', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    const result = runAssetSuite(db, 'test', 'variant', 'v1');

    expect(result.run.id).toMatch(/^pr_/);
    expect(result.run.tool_name).toBe('proof_run_asset_suite');
    expect(result.passed).toBe(true);

    const assertions = getAssertions(db, result.run.id);
    expect(assertions.length).toBeGreaterThanOrEqual(3);
  });

  it('proof_run_encounter_suite checks structural + dependency validation', () => {
    seedEncounter('enc1', 'ch1');
    insertValidationRun('enc1', 'structural', 'pass');
    insertValidationRun('enc1', 'dependencies', 'pass');

    const result = runEncounterSuite(db, 'test', 'encounter', 'enc1');
    expect(result.run.tool_name).toBe('proof_run_encounter_suite');
    expect(result.passed).toBe(true);

    const assertions = getAssertions(db, result.run.id);
    const keys = assertions.map(a => a.assertion_key);
    expect(keys).toContain('structural_valid');
    expect(keys).toContain('deps_valid');
  });

  it('proof_get_freeze_readiness returns correct status', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'v1');
    expect(readiness.readiness).toBe('ready');
    expect(readiness.scope_type).toBe('variant');
    expect(readiness.scope_id).toBe('v1');
    expect(readiness.next_action).toContain('freeze candidate');
  });

  it('proof_freeze_candidate creates candidate with correct status', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');

    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    expect(candidate.id).toMatch(/^fc_/);
    expect(candidate.status).toBe('candidate');
    expect(candidate.candidate_hash).toBeTruthy();
  });

  it('proof_promote_freeze creates receipt and state event', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');

    const receipt = promoteFreeze(db, 'test', candidate.id);
    expect(receipt.id).toMatch(/^fr_/);
    expect(receipt.receipt_hash).toBeTruthy();
    expect(receipt.source_candidate_id).toBe(candidate.id);

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'variant' AND entity_id = 'v1' AND to_state = 'frozen'"
    ).all();
    expect(events).toHaveLength(1);
  });

  it('proof_get_next_step returns recommended action', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');

    const step = getProofNextStep(db, 'test', 'variant', 'v1');
    expect(step.scope_type).toBe('variant');
    expect(step.scope_id).toBe('v1');
    expect(step.recommended_action).toBeTruthy();
    expect(step.latest_runs.length).toBeGreaterThan(0);
  });
});
