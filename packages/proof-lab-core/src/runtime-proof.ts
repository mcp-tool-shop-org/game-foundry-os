import type Database from 'better-sqlite3';
import type { ProofRunRow, VariantRow } from '@mcptoolshop/game-foundry-registry';
import { createProofRun, addAssertion } from './runs.js';
import fs from 'node:fs';
import path from 'node:path';

export interface RuntimeSuiteResult {
  run: ProofRunRow;
  passed: boolean;
  assertions: Array<{ key: string; status: string; message: string }>;
}

/** Count direction files in a pack directory (e.g. front.png, back.png, side.png, etc.) */
function countDirectionFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  try {
    const files = fs.readdirSync(dirPath);
    return files.filter(f => /\.(png|webp|tres)$/i.test(f)).length;
  } catch {
    return 0;
  }
}

/** Build the expected pack albedo directory for a variant */
function packAlbedoDir(projectRoot: string, packName: string, variantName: string): string {
  return path.join(projectRoot, 'assets', 'sprites', packName, variantName);
}

export function runRuntimeSuite(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
  projectRoot: string,
): RuntimeSuiteResult {
  const assertions: Array<{ key: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

  // Get variants in scope
  let variants: VariantRow[];
  if (scopeType === 'variant') {
    const v = db.prepare('SELECT * FROM variants WHERE id = ?').get(scopeId) as VariantRow | undefined;
    variants = v ? [v] : [];
  } else if (scopeType === 'chapter') {
    variants = db.prepare(`
      SELECT v.* FROM variants v
      JOIN characters c ON v.character_id = c.id
      WHERE c.project_id = ? AND c.chapter_primary = ?
    `).all(projectId, scopeId) as VariantRow[];
  } else {
    variants = db.prepare(`
      SELECT v.* FROM variants v
      JOIN characters c ON v.character_id = c.id
      WHERE c.project_id = ?
    `).all(projectId) as VariantRow[];
  }

  if (variants.length === 0) {
    assertions.push({ key: 'variants_found', status: 'warn', message: `No variants in scope ${scopeType}:${scopeId}` });
  }

  for (const v of variants) {
    const packName = v.canonical_pack_name || v.character_id;
    const varName = v.runtime_variant_name || v.variant_type;
    const dirPath = packAlbedoDir(projectRoot, packName, varName);

    // Check directory exists
    if (fs.existsSync(dirPath)) {
      assertions.push({ key: `${v.id}_dir_exists`, status: 'pass', message: `${v.id}: runtime dir exists` });

      // Check direction file count
      const fileCount = countDirectionFiles(dirPath);
      if (fileCount >= 8) {
        assertions.push({ key: `${v.id}_dir_files`, status: 'pass', message: `${v.id}: ${fileCount} direction files` });
      } else {
        assertions.push({ key: `${v.id}_dir_files`, status: 'fail', message: `${v.id}: only ${fileCount}/8 direction files` });
      }
    } else {
      assertions.push({ key: `${v.id}_dir_exists`, status: 'fail', message: `${v.id}: runtime dir missing at ${dirPath}` });
    }

    // Check pack_present in registry matches filesystem
    if (v.pack_present === 1 && !fs.existsSync(dirPath)) {
      assertions.push({ key: `${v.id}_registry_mismatch`, status: 'fail', message: `${v.id}: registry says pack_present but dir missing` });
    }

    // Check for phase2 variant resolution
    if (v.variant_type === 'phase2') {
      const phase2Dir = packAlbedoDir(projectRoot, packName, `phase2`);
      if (fs.existsSync(phase2Dir) || fs.existsSync(dirPath)) {
        assertions.push({ key: `${v.id}_phase2_resolve`, status: 'pass', message: `${v.id}: phase2 variant resolves` });
      } else {
        assertions.push({ key: `${v.id}_phase2_resolve`, status: 'fail', message: `${v.id}: phase2 variant does not resolve` });
      }
    }
  }

  const failures = assertions.filter(a => a.status === 'fail');
  const warnings = assertions.filter(a => a.status === 'warn');
  const result = failures.length > 0 ? 'fail' as const : 'pass' as const;

  const suite = ensureSuite(db, projectId, 'runtime', scopeType);

  const run = createProofRun(db, {
    project_id: projectId,
    suite_id: suite,
    scope_type: scopeType,
    scope_id: scopeId,
    result,
    blocking_failures: failures.length,
    warning_count: warnings.length,
    summary: `Runtime suite: ${result} (${failures.length} failures, ${warnings.length} warnings)`,
    tool_name: 'proof_run_runtime_suite',
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
  `).run(id, projectId, suiteKey, scopeType, `Runtime Proof (${scopeType})`);
  return id;
}
