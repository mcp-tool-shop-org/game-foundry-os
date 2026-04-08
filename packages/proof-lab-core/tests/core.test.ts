import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
  upsertPack,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  // Suites
  createSuite,
  getSuite,
  listSuites,
  // Runs
  createProofRun,
  addAssertion,
  getProofRun,
  getLatestRun,
  listRuns,
  getAssertions,
  // Asset proof
  runAssetSuite,
  // Encounter proof
  runEncounterSuite,
  // Freeze
  getFreezeReadiness,
  createFreezeCandidate,
  promoteFreeze,
  revokeFreeze,
  // Regressions
  detectRegressions,
  listRegressions,
  // Next step
  getProofNextStep,
  // Timeline
  getProofTimeline,
  // Report
  generateFreezeReport,
} from '@mcptoolshop/proof-lab-core';

let db: Database.Database;

function seedBasicProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function seedCharacterWithVariant(opts?: {
  charId?: string;
  varId?: string;
  chapter?: string;
  packPresent?: number;
  dirsPresent?: number;
  prodState?: string;
}) {
  const charId = opts?.charId ?? 'char1';
  const varId = opts?.varId ?? 'var1';
  const chapter = opts?.chapter ?? 'ch1';
  upsertCharacter(db, { id: charId, project_id: 'test', display_name: `Char ${charId}` });
  db.prepare('UPDATE characters SET chapter_primary = ? WHERE id = ?').run(chapter, charId);
  upsertVariant(db, { id: varId, character_id: charId, variant_type: 'base' });

  if (opts?.packPresent !== undefined || opts?.dirsPresent !== undefined || opts?.prodState) {
    const sets: string[] = [];
    if (opts?.packPresent !== undefined) sets.push(`pack_present = ${opts.packPresent}`);
    if (opts?.dirsPresent !== undefined) sets.push(`directions_present = ${opts.dirsPresent}`);
    if (opts?.prodState) sets.push(`production_state = '${opts.prodState}'`);
    if (sets.length > 0) {
      db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(varId);
    }
  }
}

function seedEncounter(id = 'enc1', chapter = 'ch1') {
  upsertEncounter(db, { id, project_id: 'test', chapter, label: `Encounter ${id}`, grid_rows: 3, grid_cols: 8 });
  db.prepare("UPDATE encounters SET display_name = ?, encounter_type = 'standard' WHERE id = ?").run(`Encounter ${id}`, id);
}

function insertValidationRun(encounterId: string, validationType: string, result: string) {
  db.prepare(`
    INSERT INTO encounter_validation_runs (encounter_id, validation_type, result)
    VALUES (?, ?, ?)
  `).run(encounterId, validationType, result);
}

function insertExport(encounterId: string) {
  db.prepare(`
    INSERT INTO encounter_exports (id, encounter_id, project_id, manifest_path, is_canonical)
    VALUES (?, ?, 'test', '/tmp/manifest.json', 1)
  `).run(`exp_${encounterId}`, encounterId);
}

function insertSyncReceipt(encounterId: string) {
  db.prepare(`
    INSERT INTO encounter_sync_receipts (id, encounter_id, project_id, target_path)
    VALUES (?, ?, 'test', '/tmp/runtime')
  `).run(`sync_${encounterId}`, encounterId);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedBasicProject();
});

// ─── Proof Runs ──────────────────────────────────────────

describe('proof runs', () => {
  it('creates a proof run with generated ID and receipt hash', () => {
    const run = createProofRun(db, {
      project_id: 'test',
      scope_type: 'variant',
      scope_id: 'var1',
      result: 'pass',
      blocking_failures: 0,
      warning_count: 0,
    });
    expect(run.id).toMatch(/^pr_/);
    expect(run.receipt_hash).toBeTruthy();
    expect(run.result).toBe('pass');
    expect(run.scope_type).toBe('variant');
    expect(run.scope_id).toBe('var1');
  });

  it('adds assertions to a run', () => {
    const run = createProofRun(db, {
      project_id: 'test',
      scope_type: 'variant',
      scope_id: 'var1',
      result: 'pass',
      blocking_failures: 0,
      warning_count: 0,
    });
    const a1 = addAssertion(db, run.id, 'check_pack', 'pass', 'Pack OK');
    const a2 = addAssertion(db, run.id, 'check_dirs', 'fail', 'Missing directions');

    expect(a1.assertion_key).toBe('check_pack');
    expect(a2.status).toBe('fail');

    const all = getAssertions(db, run.id);
    expect(all).toHaveLength(2);
  });

  it('getLatestRun returns most recent for scope', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    const run2 = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });

    const latest = getLatestRun(db, 'variant', 'var1');
    expect(latest).toBeTruthy();
    expect(latest!.id).toBe(run2.id);
    expect(latest!.result).toBe('pass');
  });

  it('listRuns returns all runs for scope', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });

    const runs = listRuns(db, 'variant', 'var1');
    expect(runs).toHaveLength(2);
  });

  it('getProofRun returns run by id', () => {
    const run = createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    const found = getProofRun(db, run.id);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(run.id);
  });
});

// ─── Suites ──────────────────────────────────────────────

describe('suites', () => {
  it('creates and retrieves a suite', () => {
    const suite = createSuite(db, { project_id: 'test', suite_key: 'asset', scope_type: 'variant', display_name: 'Asset Proof' });
    expect(suite.id).toMatch(/^suite_/);
    expect(suite.suite_key).toBe('asset');

    const found = getSuite(db, suite.id);
    expect(found).toBeTruthy();
    expect(found!.suite_key).toBe('asset');
  });

  it('lists suites by project', () => {
    createSuite(db, { project_id: 'test', suite_key: 'asset', scope_type: 'variant', display_name: 'Asset' });
    createSuite(db, { project_id: 'test', suite_key: 'encounter', scope_type: 'encounter', display_name: 'Encounter' });

    const all = listSuites(db, 'test');
    expect(all).toHaveLength(2);

    const variantOnly = listSuites(db, 'test', 'variant');
    expect(variantOnly).toHaveLength(1);
  });
});

// ─── Asset Proof Suite ───────────────────────────────────

describe('asset proof suite', () => {
  it('passes for variant with pack_present and directions', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    const result = runAssetSuite(db, 'test', 'variant', 'var1');
    expect(result.passed).toBe(true);
    expect(result.run.result).toBe('pass');
  });

  it('fails for variant with missing pack', () => {
    seedCharacterWithVariant({ packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    const result = runAssetSuite(db, 'test', 'variant', 'var1');
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'pack_present' && a.status === 'fail')).toBe(true);
  });

  it('fails for variant with insufficient directions', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 5, prodState: 'pack_sliced' });
    const result = runAssetSuite(db, 'test', 'variant', 'var1');
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'directions_complete' && a.status === 'fail')).toBe(true);
  });

  it('fails for variant with early production state', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'concept_locked' });
    const result = runAssetSuite(db, 'test', 'variant', 'var1');
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'production_state_sufficient' && a.status === 'fail')).toBe(true);
  });

  it('creates assertions for each check', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'engine_synced' });
    const result = runAssetSuite(db, 'test', 'variant', 'var1');
    expect(result.assertions.length).toBeGreaterThanOrEqual(3);

    const stored = getAssertions(db, result.run.id);
    expect(stored.length).toBeGreaterThanOrEqual(3);
  });

  it('runs chapter scope across multiple variants', () => {
    seedCharacterWithVariant({ charId: 'c1', varId: 'v1', chapter: 'ch1', packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    seedCharacterWithVariant({ charId: 'c2', varId: 'v2', chapter: 'ch1', packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    const result = runAssetSuite(db, 'test', 'chapter', 'ch1');
    expect(result.passed).toBe(false);
    expect(result.run.blocking_failures).toBeGreaterThan(0);
  });
});

// ─── Encounter Proof Suite ───────────────────────────────

describe('encounter proof suite', () => {
  it('passes for encounter with valid structural + dependency validation', () => {
    seedEncounter('enc1');
    insertValidationRun('enc1', 'structural', 'pass');
    insertValidationRun('enc1', 'dependencies', 'pass');
    insertExport('enc1');
    insertSyncReceipt('enc1');

    const result = runEncounterSuite(db, 'test', 'encounter', 'enc1');
    expect(result.passed).toBe(true);
  });

  it('fails when structural validation never ran', () => {
    seedEncounter('enc1');
    const result = runEncounterSuite(db, 'test', 'encounter', 'enc1');
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'structural_valid' && a.status === 'fail')).toBe(true);
  });

  it('fails when dependency validation failed', () => {
    seedEncounter('enc1');
    insertValidationRun('enc1', 'structural', 'pass');
    insertValidationRun('enc1', 'dependencies', 'fail');

    const result = runEncounterSuite(db, 'test', 'encounter', 'enc1');
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'deps_valid' && a.status === 'fail')).toBe(true);
  });

  it('warns when export or sync receipt missing', () => {
    seedEncounter('enc1');
    insertValidationRun('enc1', 'structural', 'pass');
    insertValidationRun('enc1', 'dependencies', 'pass');

    const result = runEncounterSuite(db, 'test', 'encounter', 'enc1');
    // Should pass because missing export/sync are warnings, not failures
    expect(result.passed).toBe(true);
    expect(result.assertions.some(a => a.key === 'export_exists' && a.status === 'warn')).toBe(true);
    expect(result.assertions.some(a => a.key === 'sync_receipt' && a.status === 'warn')).toBe(true);
  });
});

// ─── Freeze Readiness ────────────────────────────────────

describe('freeze readiness', () => {
  it('returns ready when all blocking suites passed', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    // Run suite (auto-creates blocking suite)
    runAssetSuite(db, 'test', 'variant', 'var1');

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'var1');
    expect(readiness.readiness).toBe('ready');
    expect(readiness.blocking_reasons).toHaveLength(0);
  });

  it('returns blocked when a blocking suite failed', () => {
    seedCharacterWithVariant({ packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'var1');
    expect(readiness.readiness).toBe('blocked');
    expect(readiness.blocking_reasons.length).toBeGreaterThan(0);
  });

  it('returns warning_only when only non-blocking suites failed', () => {
    // Create a non-blocking suite that fails
    const suiteId = 'suite_nb';
    db.prepare(`
      INSERT INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
      VALUES (?, 'test', 'presentation', 'variant', 'Presentation', 0)
    `).run(suiteId);
    createProofRun(db, {
      project_id: 'test', suite_id: suiteId, scope_type: 'variant', scope_id: 'var1',
      result: 'fail', blocking_failures: 1, warning_count: 0,
    });

    const readiness = getFreezeReadiness(db, 'test', 'variant', 'var1');
    expect(readiness.readiness).toBe('warning_only');
  });
});

// ─── Freeze Candidate ────────────────────────────────────

describe('freeze candidate', () => {
  it('creates candidate with status=candidate when ready', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');

    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');
    expect(candidate.status).toBe('candidate');
    expect(candidate.id).toMatch(/^fc_/);
  });

  it('creates candidate with status=blocked when not ready', () => {
    seedCharacterWithVariant({ packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');

    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');
    expect(candidate.status).toBe('blocked');
    expect(candidate.blocking_reasons_json).toBeTruthy();
  });
});

// ─── Freeze Promotion ────────────────────────────────────

describe('freeze promotion', () => {
  it('promotes valid candidate to frozen', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');

    const receipt = promoteFreeze(db, 'test', candidate.id);
    expect(receipt.id).toMatch(/^fr_/);
    expect(receipt.receipt_hash).toBeTruthy();
    expect(receipt.source_candidate_id).toBe(candidate.id);

    // Check candidate status updated
    const updated = db.prepare('SELECT status FROM freeze_candidates WHERE id = ?').get(candidate.id) as { status: string };
    expect(updated.status).toBe('promoted');
  });

  it('rejects promotion of blocked candidate', () => {
    seedCharacterWithVariant({ packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');

    expect(() => promoteFreeze(db, 'test', candidate.id)).toThrow(/Cannot promote/);
  });

  it('creates freeze receipt on promotion', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'engine_synced' });
    runAssetSuite(db, 'test', 'variant', 'var1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');
    const receipt = promoteFreeze(db, 'test', candidate.id);

    const receipts = db.prepare('SELECT * FROM freeze_receipts WHERE scope_type = ? AND scope_id = ?')
      .all('variant', 'var1');
    expect(receipts).toHaveLength(1);
  });

  it('emits state event on promotion', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');
    promoteFreeze(db, 'test', candidate.id);

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'variant' AND entity_id = 'var1' AND to_state = 'frozen'"
    ).all();
    expect(events).toHaveLength(1);
  });
});

// ─── Freeze Revocation ───────────────────────────────────

describe('freeze revocation', () => {
  it('revokes freeze and creates regression', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');
    promoteFreeze(db, 'test', candidate.id);

    revokeFreeze(db, 'test', 'variant', 'var1', 'Pack was corrupted');

    const updated = db.prepare('SELECT status FROM freeze_candidates WHERE id = ?').get(candidate.id) as { status: string };
    expect(updated.status).toBe('revoked');

    const regs = listRegressions(db, 'test', 'variant', 'var1');
    expect(regs.some(r => r.regression_type === 'freeze_revocation')).toBe(true);
  });
});

// ─── Regressions ─────────────────────────────────────────

describe('regressions', () => {
  it('detects regression when latest run fails after prior pass', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'fail', blocking_failures: 2, warning_count: 0 });

    const result = detectRegressions(db, 'test', 'variant', 'var1');
    expect(result.regressions_found).toBe(1);
    expect(result.new_regressions[0].severity).toBe('critical');
  });

  it('no regression when latest run still passes', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });

    const result = detectRegressions(db, 'test', 'variant', 'var1');
    expect(result.regressions_found).toBe(0);
  });

  it('no regression when only one run exists', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'fail', blocking_failures: 1, warning_count: 0 });

    const result = detectRegressions(db, 'test', 'variant', 'var1');
    expect(result.regressions_found).toBe(0);
  });

  it('lists regressions by project', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    detectRegressions(db, 'test', 'variant', 'var1');

    const all = listRegressions(db, 'test');
    expect(all).toHaveLength(1);
  });
});

// ─── Next Step ───────────────────────────────────────────

describe('next-step', () => {
  it('suggests running suites when no proof runs exist', () => {
    const result = getProofNextStep(db, 'test', 'variant', 'var1');
    expect(result.recommended_action).toContain('No proof suites');
  });

  it('suggests freeze_candidate when all suites pass', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');

    const result = getProofNextStep(db, 'test', 'variant', 'var1');
    expect(result.recommended_action).toContain('freeze candidate');
  });

  it('reports blockers when suites fail', () => {
    seedCharacterWithVariant({ packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');

    const result = getProofNextStep(db, 'test', 'variant', 'var1');
    expect(result.recommended_action).toContain('Fix failing');
    expect(result.latest_failures.length).toBeGreaterThan(0);
  });
});

// ─── Timeline ────────────────────────────────────────────

describe('timeline', () => {
  it('returns chronological proof events', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });

    const timeline = getProofTimeline(db, 'test', 'variant', 'var1');
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline[0].type).toBe('proof_run');
  });

  it('includes freeze candidates and receipts', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'var1');
    promoteFreeze(db, 'test', candidate.id);

    const timeline = getProofTimeline(db, 'test', 'variant', 'var1');
    const types = timeline.map(t => t.type);
    expect(types).toContain('proof_run');
    expect(types).toContain('freeze_candidate');
    expect(types).toContain('freeze_receipt');
    expect(types).toContain('state_event');
  });
});

// ─── Freeze Report ───────────────────────────────────────

describe('freeze report', () => {
  it('generates report with latest suite results', () => {
    seedCharacterWithVariant({ packPresent: 1, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');

    const report = generateFreezeReport(db, 'test', 'variant', 'var1');
    expect(report.project_id).toBe('test');
    expect(report.scope_type).toBe('variant');
    expect(report.scope_id).toBe('var1');
    expect(report.suites.length).toBeGreaterThan(0);
    expect(report.generated_at).toBeTruthy();
  });

  it('includes readiness status and blockers', () => {
    seedCharacterWithVariant({ packPresent: 0, dirsPresent: 8, prodState: 'pack_sliced' });
    runAssetSuite(db, 'test', 'variant', 'var1');

    const report = generateFreezeReport(db, 'test', 'variant', 'var1');
    expect(report.readiness).toBe('blocked');
    expect(report.blockers.length).toBeGreaterThan(0);
  });

  it('includes regressions in report', () => {
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'pass', blocking_failures: 0, warning_count: 0 });
    createProofRun(db, { project_id: 'test', scope_type: 'variant', scope_id: 'var1', result: 'fail', blocking_failures: 1, warning_count: 0 });
    detectRegressions(db, 'test', 'variant', 'var1');

    const report = generateFreezeReport(db, 'test', 'variant', 'var1');
    expect(report.regressions).toHaveLength(1);
  });
});
