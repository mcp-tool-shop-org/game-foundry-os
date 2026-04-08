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
  detectRegressions,
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

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('freeze report edge cases', () => {
  it('report includes all suite types that have been run', () => {
    seedVariant('v1', { packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });

    // Run asset suite (auto-creates blocking asset suite for variant scope)
    runAssetSuite(db, 'test', 'variant', 'v1');

    // Also create and run an encounter suite for variant scope
    const encSuiteId = 'suite_encounter_variant';
    db.prepare(`
      INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
      VALUES (?, 'test', 'encounter', 'variant', 'Encounter Proof', 1)
    `).run(encSuiteId);
    createProofRun(db, {
      project_id: 'test',
      suite_id: encSuiteId,
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'pass',
      blocking_failures: 0,
      warning_count: 0,
    });

    const report = generateFreezeReport(db, 'test', 'variant', 'v1');
    expect(report.suites.length).toBe(2);
    const suiteKeys = report.suites.map(s => s.suite_key);
    expect(suiteKeys).toContain('asset');
    expect(suiteKeys).toContain('encounter');
  });

  it('report shows regression count when regressions exist', () => {
    // Create pass → fail to trigger regression
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'v1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    detectRegressions(db, 'test', 'variant', 'v1');

    const report = generateFreezeReport(db, 'test', 'variant', 'v1');
    expect(report.regressions).toHaveLength(1);
    expect(report.regressions[0].severity).toBe('critical');
    expect(report.regressions[0].type).toBe('proof_regression');
  });

  it('report for scope with no proof runs returns empty state', () => {
    const report = generateFreezeReport(db, 'test', 'variant', 'v_nonexistent');
    expect(report.suites).toHaveLength(0);
    expect(report.regressions).toHaveLength(0);
    expect(report.readiness).toBeDefined();
    expect(report.generated_at).toBeTruthy();
  });

  it('report includes debt summary with blocking vs warning counts', () => {
    seedVariant('v1', { packPresent: 0, dirsPresent: 5, prodState: 'draft' });
    // Asset suite will fail (blocking)
    runAssetSuite(db, 'test', 'variant', 'v1');

    // Create non-blocking presentation suite with warnings
    const presId = 'suite_pres_variant';
    db.prepare(`
      INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
      VALUES (?, 'test', 'presentation', 'variant', 'Presentation', 0)
    `).run(presId);
    createProofRun(db, {
      project_id: 'test',
      suite_id: presId,
      scope_type: 'variant',
      scope_id: 'v1',
      result: 'fail',
      blocking_failures: 0,
      warning_count: 2,
    });

    const report = generateFreezeReport(db, 'test', 'variant', 'v1');
    expect(report.readiness).toBe('blocked');
    expect(report.blockers.length).toBeGreaterThan(0);
    expect(report.warnings.length).toBeGreaterThan(0);
    // Asset suite is blocking (failed), presentation is non-blocking (warning)
    const assetEntry = report.suites.find(s => s.suite_key === 'asset');
    const presEntry = report.suites.find(s => s.suite_key === 'presentation');
    expect(assetEntry).toBeDefined();
    expect(assetEntry!.blocking_failures).toBeGreaterThan(0);
    expect(presEntry).toBeDefined();
  });
});
