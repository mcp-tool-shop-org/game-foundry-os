import type Database from 'better-sqlite3';
import type { ProofRunRow, EncounterRow } from '@mcptoolshop/game-foundry-registry';
import { createProofRun, addAssertion } from './runs.js';

export interface EncounterSuiteResult {
  run: ProofRunRow;
  passed: boolean;
  assertions: Array<{ key: string; status: string; message: string }>;
}

export function runEncounterSuite(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): EncounterSuiteResult {
  const assertions: Array<{ key: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

  const encounters = scopeType === 'encounter'
    ? [db.prepare('SELECT * FROM encounters WHERE id = ?').get(scopeId) as EncounterRow | undefined].filter(Boolean) as EncounterRow[]
    : db.prepare('SELECT * FROM encounters WHERE project_id = ? AND chapter = ?').all(projectId, scopeId) as EncounterRow[];

  if (encounters.length === 0) {
    assertions.push({ key: 'encounters_exist', status: 'fail', message: `No encounters found for ${scopeType}:${scopeId}` });
  }

  for (const enc of encounters) {
    const prefix = scopeType === 'encounter' ? '' : `${enc.id}_`;

    // Check structural validation passed
    const structValid = db.prepare(`
      SELECT * FROM encounter_validation_runs
      WHERE encounter_id = ? AND validation_type = 'structural' AND result = 'pass'
      ORDER BY created_at DESC LIMIT 1
    `).get(enc.id);
    if (structValid) {
      assertions.push({ key: `${prefix}structural_valid`, status: 'pass', message: `${enc.id}: structural validation passed` });
    } else {
      assertions.push({ key: `${prefix}structural_valid`, status: 'fail', message: `${enc.id}: structural validation not passed` });
    }

    // Check dependency validation passed
    const depValid = db.prepare(`
      SELECT * FROM encounter_validation_runs
      WHERE encounter_id = ? AND validation_type = 'dependencies' AND result = 'pass'
      ORDER BY created_at DESC LIMIT 1
    `).get(enc.id);
    if (depValid) {
      assertions.push({ key: `${prefix}deps_valid`, status: 'pass', message: `${enc.id}: dependency validation passed` });
    } else {
      assertions.push({ key: `${prefix}deps_valid`, status: 'fail', message: `${enc.id}: dependency validation not passed` });
    }

    // Check export exists
    const exportExists = db.prepare(`
      SELECT id FROM encounter_exports WHERE encounter_id = ? AND is_canonical = 1 LIMIT 1
    `).get(enc.id);
    if (exportExists) {
      assertions.push({ key: `${prefix}export_exists`, status: 'pass', message: `${enc.id}: canonical export found` });
    } else {
      assertions.push({ key: `${prefix}export_exists`, status: 'warn', message: `${enc.id}: no canonical export` });
    }

    // Check sync receipt exists
    const syncReceipt = db.prepare(`
      SELECT id FROM encounter_sync_receipts WHERE encounter_id = ? LIMIT 1
    `).get(enc.id);
    if (syncReceipt) {
      assertions.push({ key: `${prefix}sync_receipt`, status: 'pass', message: `${enc.id}: sync receipt found` });
    } else {
      assertions.push({ key: `${prefix}sync_receipt`, status: 'warn', message: `${enc.id}: no sync receipt` });
    }
  }

  const failures = assertions.filter(a => a.status === 'fail');
  const warnings = assertions.filter(a => a.status === 'warn');
  const result = failures.length > 0 ? 'fail' as const : 'pass' as const;

  const suite = ensureSuite(db, projectId, 'encounter', scopeType);

  const run = createProofRun(db, {
    project_id: projectId,
    suite_id: suite,
    scope_type: scopeType,
    scope_id: scopeId,
    result,
    blocking_failures: failures.length,
    warning_count: warnings.length,
    summary: `Encounter suite: ${result} (${failures.length} failures, ${warnings.length} warnings)`,
    tool_name: 'proof_run_encounter_suite',
  });

  for (const a of assertions) {
    addAssertion(db, run.id, a.key, a.status, a.message);
  }

  return { run, passed: result === 'pass', assertions };
}

function ensureSuite(db: Database.Database, projectId: string, suiteKey: string, scopeType: string): string {
  const existing = db.prepare(
    'SELECT id FROM proof_suites WHERE project_id = ? AND suite_key = ? AND scope_type = ?'
  ).get(projectId, suiteKey, scopeType) as { id: string } | undefined;
  if (existing) return existing.id;

  const id = `suite_${suiteKey}_${scopeType}`;
  db.prepare(`
    INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, projectId, suiteKey, scopeType, `Encounter Proof (${scopeType})`);
  return id;
}
