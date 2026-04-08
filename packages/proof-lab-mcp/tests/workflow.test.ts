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
  createProofRun,
  getFreezeReadiness,
  createFreezeCandidate,
  promoteFreeze,
  revokeFreeze,
  detectRegressions,
  listRegressions,
  generateFreezeReport,
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

function insertExport(encounterId: string) {
  db.prepare(`INSERT INTO encounter_exports (id, encounter_id, project_id, manifest_path, is_canonical) VALUES (?, ?, 'test', '/tmp/m.json', 1)`).run(`exp_${encounterId}`, encounterId);
}

function insertSyncReceipt(encounterId: string) {
  db.prepare(`INSERT INTO encounter_sync_receipts (id, encounter_id, project_id, target_path) VALUES (?, ?, 'test', '/tmp/r')`).run(`sync_${encounterId}`, encounterId);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('full proof-to-freeze workflow', () => {
  it('runs asset suite for variant → pass', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    const result = runAssetSuite(db, 'test', 'variant', 'v1');
    expect(result.passed).toBe(true);
    expect(result.run.result).toBe('pass');
  });

  it('runs encounter suite for encounter → pass', () => {
    seedEncounter('enc1', 'ch1');
    insertValidationRun('enc1', 'structural', 'pass');
    insertValidationRun('enc1', 'dependencies', 'pass');
    insertExport('enc1');
    insertSyncReceipt('enc1');

    const result = runEncounterSuite(db, 'test', 'encounter', 'enc1');
    expect(result.passed).toBe(true);
    expect(result.run.result).toBe('pass');
  });

  it('gets freeze readiness → ready', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'v1');
    expect(readiness.readiness).toBe('ready');
    expect(readiness.blocking_reasons).toHaveLength(0);
  });

  it('creates freeze candidate → status=candidate', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');

    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    expect(candidate.status).toBe('candidate');
  });

  it('promotes freeze → receipt created', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');

    const receipt = promoteFreeze(db, 'test', candidate.id);
    expect(receipt.id).toMatch(/^fr_/);
    expect(receipt.source_candidate_id).toBe(candidate.id);

    // Candidate should be promoted
    const updated = db.prepare('SELECT status FROM freeze_candidates WHERE id = ?').get(candidate.id) as { status: string };
    expect(updated.status).toBe('promoted');
  });

  it('detects regression when new run fails after freeze', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    promoteFreeze(db, 'test', candidate.id);

    // Now create a failing run (simulating broken state)
    createProofRun(db, {
      project_id: 'test',
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'fail',
      blocking_failures: 2,
      warning_count: 0,
    });

    const result = detectRegressions(db, 'test', 'variant', 'v1');
    expect(result.regressions_found).toBe(1);
    expect(result.new_regressions[0].severity).toBe('critical');
  });

  it('revokes freeze on regression', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    promoteFreeze(db, 'test', candidate.id);

    revokeFreeze(db, 'test', 'variant', 'v1', 'Critical regression detected');

    const updated = db.prepare('SELECT status FROM freeze_candidates WHERE id = ?').get(candidate.id) as { status: string };
    expect(updated.status).toBe('revoked');

    const regs = listRegressions(db, 'test', 'variant', 'v1');
    expect(regs.some(r => r.regression_type === 'freeze_revocation')).toBe(true);
  });

  it('generates freeze report with complete history', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'v1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'v1');
    promoteFreeze(db, 'test', candidate.id);

    // Trigger a regression
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    detectRegressions(db, 'test', 'variant', 'v1');

    const report = generateFreezeReport(db, 'test', 'variant', 'v1');
    expect(report.project_id).toBe('test');
    expect(report.scope_type).toBe('variant');
    expect(report.scope_id).toBe('v1');
    expect(report.suites.length).toBeGreaterThan(0);
    expect(report.regressions).toHaveLength(1);
    expect(report.generated_at).toBeTruthy();
  });
});
