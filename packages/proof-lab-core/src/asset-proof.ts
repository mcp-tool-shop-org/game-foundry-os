import type Database from 'better-sqlite3';
import type { ProofRunRow, VariantRow } from '@mcptoolshop/game-foundry-registry';
import { createProofRun, addAssertion } from './runs.js';

export interface AssetSuiteResult {
  run: ProofRunRow;
  passed: boolean;
  assertions: Array<{ key: string; status: string; message: string }>;
}

export function runAssetSuite(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): AssetSuiteResult {
  const assertions: Array<{ key: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

  if (scopeType === 'variant') {
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(scopeId) as VariantRow | undefined;
    if (!variant) {
      assertions.push({ key: 'variant_exists', status: 'fail', message: `Variant ${scopeId} not found` });
    } else {
      // Check pack_present
      if (variant.pack_present === 1) {
        assertions.push({ key: 'pack_present', status: 'pass', message: 'Pack is present' });
      } else {
        assertions.push({ key: 'pack_present', status: 'fail', message: 'Pack not present' });
      }

      // Check directions_present >= 8
      if (variant.directions_present >= 8) {
        assertions.push({ key: 'directions_complete', status: 'pass', message: `${variant.directions_present} directions present` });
      } else {
        assertions.push({ key: 'directions_complete', status: 'fail', message: `Only ${variant.directions_present}/8 directions present` });
      }

      // Check production_state is at least pack_sliced
      const minStates = ['pack_sliced', 'engine_synced', 'proved', 'frozen'];
      if (minStates.includes(variant.production_state)) {
        assertions.push({ key: 'production_state_sufficient', status: 'pass', message: `State: ${variant.production_state}` });
      } else {
        assertions.push({ key: 'production_state_sufficient', status: 'fail', message: `State ${variant.production_state} < pack_sliced` });
      }

      // Check engine sync receipt exists
      const syncReceipt = db.prepare(`
        SELECT id FROM state_events
        WHERE entity_type = 'variant' AND entity_id = ? AND to_state = 'engine_synced'
        ORDER BY created_at DESC LIMIT 1
      `).get(scopeId);
      if (syncReceipt) {
        assertions.push({ key: 'engine_sync_receipt', status: 'pass', message: 'Engine sync receipt found' });
      } else {
        assertions.push({ key: 'engine_sync_receipt', status: 'warn', message: 'No engine sync receipt' });
      }
    }
  } else if (scopeType === 'chapter') {
    // Run across all variants in the chapter
    const variants = db.prepare(`
      SELECT v.* FROM variants v
      JOIN characters c ON v.character_id = c.id
      WHERE c.project_id = ? AND c.chapter_primary = ?
    `).all(projectId, scopeId) as VariantRow[];

    if (variants.length === 0) {
      assertions.push({ key: 'chapter_has_variants', status: 'warn', message: `No variants found for chapter ${scopeId}` });
    }

    for (const v of variants) {
      const packOk = v.pack_present === 1;
      const dirsOk = v.directions_present >= 8;
      const stateOk = ['pack_sliced', 'engine_synced', 'proved', 'frozen'].includes(v.production_state);

      if (!packOk) assertions.push({ key: `${v.id}_pack`, status: 'fail', message: `${v.id}: pack not present` });
      if (!dirsOk) assertions.push({ key: `${v.id}_dirs`, status: 'fail', message: `${v.id}: ${v.directions_present}/8 directions` });
      if (!stateOk) assertions.push({ key: `${v.id}_state`, status: 'fail', message: `${v.id}: state ${v.production_state}` });

      if (packOk && dirsOk && stateOk) {
        assertions.push({ key: `${v.id}_complete`, status: 'pass', message: `${v.id}: asset checks pass` });
      }
    }
  }

  const failures = assertions.filter(a => a.status === 'fail');
  const warnings = assertions.filter(a => a.status === 'warn');
  const result = failures.length > 0 ? 'fail' as const : 'pass' as const;

  // Ensure suite exists
  const suite = ensureSuite(db, projectId, 'asset', scopeType);

  const run = createProofRun(db, {
    project_id: projectId,
    suite_id: suite,
    scope_type: scopeType,
    scope_id: scopeId,
    result,
    blocking_failures: failures.length,
    warning_count: warnings.length,
    summary: `Asset suite: ${result} (${failures.length} failures, ${warnings.length} warnings)`,
    tool_name: 'proof_run_asset_suite',
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
  `).run(id, projectId, suiteKey, scopeType, `Asset Proof (${scopeType})`);
  return id;
}
