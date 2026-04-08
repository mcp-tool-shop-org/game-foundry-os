import type Database from 'better-sqlite3';
import crypto from 'node:crypto';

export interface SeedRegistryResult {
  policies_created: number;
  suites_created: number;
}

const DEFAULT_PROOF_SUITES = [
  { suite_key: 'asset_integrity', scope_type: 'variant', display_name: 'Asset Integrity', description: 'Validates sprite sheets, packs, and directional files exist and are well-formed', is_blocking: 1 },
  { suite_key: 'encounter_integrity', scope_type: 'encounter', display_name: 'Encounter Integrity', description: 'Validates encounter rosters, formations, and dependency resolution', is_blocking: 1 },
  { suite_key: 'runtime_integrity', scope_type: 'variant', display_name: 'Runtime Integrity', description: 'Validates engine-synced pack files exist on disk with .import sidecars', is_blocking: 1 },
  { suite_key: 'presentation', scope_type: 'variant', display_name: 'Presentation', description: 'Validates portraits and placeholder absence', is_blocking: 0 },
  { suite_key: 'chapter_spine', scope_type: 'chapter', display_name: 'Chapter Spine', description: 'Aggregated proof across all chapter assets and encounters', is_blocking: 1 },
];

const DEFAULT_FREEZE_POLICIES = [
  { scope_type: 'variant', policy_key: 'variant_freeze', policy: { require_proof_pass: true, require_engine_sync: true, require_portrait: false } },
  { scope_type: 'encounter', policy_key: 'encounter_freeze', policy: { require_proof_pass: true, require_manifest_export: true, require_all_variants_frozen: false } },
  { scope_type: 'chapter', policy_key: 'chapter_freeze', policy: { require_all_encounters_frozen: true, require_all_variants_frozen: true, require_spine_proof: true } },
];

export function seedProjectRegistry(db: Database.Database, projectId: string, _templateKey: string): SeedRegistryResult {
  let suites_created = 0;
  let policies_created = 0;

  const insertSuite = db.prepare(`
    INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, description, is_blocking)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const suite of DEFAULT_PROOF_SUITES) {
    const existing = db.prepare(
      'SELECT id FROM proof_suites WHERE project_id = ? AND suite_key = ?'
    ).get(projectId, suite.suite_key);

    if (!existing) {
      insertSuite.run(
        crypto.randomUUID(), projectId, suite.suite_key,
        suite.scope_type, suite.display_name, suite.description, suite.is_blocking,
      );
      suites_created++;
    }
  }

  const insertPolicy = db.prepare(`
    INSERT OR IGNORE INTO freeze_policies (id, project_id, scope_type, scope_id, policy_key, policy_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const policy of DEFAULT_FREEZE_POLICIES) {
    const existing = db.prepare(
      'SELECT id FROM freeze_policies WHERE project_id = ? AND policy_key = ?'
    ).get(projectId, policy.policy_key);

    if (!existing) {
      insertPolicy.run(
        crypto.randomUUID(), projectId, policy.scope_type, '*',
        policy.policy_key, JSON.stringify(policy.policy),
      );
      policies_created++;
    }
  }

  return { policies_created, suites_created };
}
