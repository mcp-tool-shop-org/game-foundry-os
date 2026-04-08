import type Database from 'better-sqlite3';

const SCHEMA_VERSION = 8;

const MIGRATIONS: string[] = [
  // Version 1: Initial schema
  `
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS projects (
    id            TEXT PRIMARY KEY,
    display_name  TEXT NOT NULL,
    root_path     TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS characters (
    id            TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL REFERENCES projects(id),
    display_name  TEXT NOT NULL,
    role          TEXT,
    family        TEXT,
    faction       TEXT,
    ai_role       TEXT,
    chapter_primary TEXT,
    concept_status      TEXT NOT NULL DEFAULT 'none',
    directional_status  TEXT NOT NULL DEFAULT 'none',
    sheet_status        TEXT NOT NULL DEFAULT 'none',
    pack_status         TEXT NOT NULL DEFAULT 'none',
    portrait_status     TEXT NOT NULL DEFAULT 'none',
    integration_status  TEXT NOT NULL DEFAULT 'none',
    freeze_status       TEXT NOT NULL DEFAULT 'none',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS variants (
    id            TEXT PRIMARY KEY,
    character_id  TEXT NOT NULL REFERENCES characters(id),
    variant_type  TEXT NOT NULL,
    pack_id       TEXT,
    phase         INTEGER,
    concept_dir   TEXT,
    directional_dir TEXT,
    sheet_path    TEXT,
    pack_dir      TEXT,
    sheet_present   INTEGER NOT NULL DEFAULT 0,
    pack_present    INTEGER NOT NULL DEFAULT 0,
    directions_present INTEGER NOT NULL DEFAULT 0,
    content_hash  TEXT,
    proof_state   TEXT NOT NULL DEFAULT 'none',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS asset_packs (
    id            TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL REFERENCES projects(id),
    pack_type     TEXT NOT NULL,
    chapter       TEXT,
    sprite_size   INTEGER NOT NULL DEFAULT 48,
    directions    INTEGER NOT NULL DEFAULT 8,
    root_path     TEXT NOT NULL,
    manifest_path TEXT,
    member_count      INTEGER NOT NULL DEFAULT 0,
    complete_members  INTEGER NOT NULL DEFAULT 0,
    engine_sync_state TEXT NOT NULL DEFAULT 'none',
    freeze_state      TEXT NOT NULL DEFAULT 'none',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS encounters (
    id            TEXT PRIMARY KEY,
    project_id    TEXT NOT NULL REFERENCES projects(id),
    chapter       TEXT NOT NULL,
    label         TEXT NOT NULL,
    doctrine      TEXT,
    max_turns     INTEGER,
    description   TEXT,
    grid_rows     INTEGER NOT NULL DEFAULT 3,
    grid_cols     INTEGER NOT NULL DEFAULT 8,
    route_nodes   TEXT,
    bounds_valid      INTEGER,
    formation_valid   INTEGER,
    variants_valid    INTEGER,
    last_validated_at TEXT,
    runtime_sync_state TEXT NOT NULL DEFAULT 'none',
    proving_state      TEXT NOT NULL DEFAULT 'none',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS encounter_enemies (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id  TEXT NOT NULL REFERENCES encounters(id),
    display_name  TEXT NOT NULL,
    variant_id    TEXT NOT NULL,
    sprite_pack   TEXT NOT NULL,
    ai_role       TEXT,
    grid_row      INTEGER NOT NULL,
    grid_col      INTEGER NOT NULL,
    hp            INTEGER,
    guard         INTEGER,
    speed         INTEGER,
    move_range    INTEGER,
    engine_data   TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS freeze_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    object_type   TEXT NOT NULL,
    object_id     TEXT NOT NULL,
    content_hash  TEXT,
    frozen_at     TEXT NOT NULL DEFAULT (datetime('now')),
    frozen_by     TEXT,
    notes         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
  CREATE INDEX IF NOT EXISTS idx_characters_family ON characters(family);
  CREATE INDEX IF NOT EXISTS idx_variants_character ON variants(character_id);
  CREATE INDEX IF NOT EXISTS idx_variants_pack ON variants(pack_id);
  CREATE INDEX IF NOT EXISTS idx_encounters_project ON encounters(project_id);
  CREATE INDEX IF NOT EXISTS idx_encounters_chapter ON encounters(chapter);
  CREATE INDEX IF NOT EXISTS idx_encounter_enemies_encounter ON encounter_enemies(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_encounter_enemies_variant ON encounter_enemies(variant_id);
  CREATE INDEX IF NOT EXISTS idx_freeze_log_object ON freeze_log(object_type, object_id);
  `,

  // Version 2: Sprite Foundry Workflow — lifecycle, batches, picks, artifacts, events
  `
  ALTER TABLE variants ADD COLUMN production_state TEXT NOT NULL DEFAULT 'draft';
  ALTER TABLE variants ADD COLUMN portrait_state TEXT NOT NULL DEFAULT 'none';
  ALTER TABLE variants ADD COLUMN display_name TEXT;
  ALTER TABLE variants ADD COLUMN runtime_variant_name TEXT;
  ALTER TABLE variants ADD COLUMN canonical_pack_name TEXT;

  CREATE TABLE IF NOT EXISTS foundry_batches (
    id              TEXT PRIMARY KEY,
    variant_id      TEXT NOT NULL REFERENCES variants(id),
    batch_type      TEXT NOT NULL,
    direction       TEXT,
    candidate_count INTEGER NOT NULL DEFAULT 0,
    source_model    TEXT,
    params_json     TEXT,
    output_dir      TEXT,
    status          TEXT NOT NULL DEFAULT 'open',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS locked_picks (
    id                  TEXT PRIMARY KEY,
    variant_id          TEXT NOT NULL REFERENCES variants(id),
    pick_type           TEXT NOT NULL,
    direction           TEXT,
    candidate_name      TEXT,
    candidate_index     INTEGER,
    locked_artifact_id  TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    variant_id      TEXT NOT NULL REFERENCES variants(id),
    artifact_type   TEXT NOT NULL,
    direction       TEXT,
    path            TEXT NOT NULL,
    content_hash    TEXT,
    width           INTEGER,
    height          INTEGER,
    metadata_json   TEXT,
    is_canonical    INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS state_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    TEXT NOT NULL,
    entity_type   TEXT NOT NULL,
    entity_id     TEXT NOT NULL,
    from_state    TEXT,
    to_state      TEXT NOT NULL,
    reason        TEXT,
    tool_name     TEXT,
    payload_json  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_batches_variant ON foundry_batches(variant_id);
  CREATE INDEX IF NOT EXISTS idx_picks_variant ON locked_picks(variant_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_variant ON artifacts(variant_id);
  CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(artifact_type, variant_id);
  CREATE INDEX IF NOT EXISTS idx_events_entity ON state_events(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_events_time ON state_events(created_at);
  `,

  // Version 3: Encounter Doctrine Workflow — encounter lifecycle, rules, exports, sync receipts
  `
  ALTER TABLE encounters ADD COLUMN production_state TEXT NOT NULL DEFAULT 'draft';
  ALTER TABLE encounters ADD COLUMN display_name TEXT;
  ALTER TABLE encounters ADD COLUMN encounter_type TEXT NOT NULL DEFAULT 'standard';
  ALTER TABLE encounters ADD COLUMN route_tag TEXT;
  ALTER TABLE encounters ADD COLUMN intent_summary TEXT;

  ALTER TABLE encounter_enemies ADD COLUMN role_tag TEXT;
  ALTER TABLE encounter_enemies ADD COLUMN team TEXT NOT NULL DEFAULT 'enemy';
  ALTER TABLE encounter_enemies ADD COLUMN spawn_group TEXT;
  ALTER TABLE encounter_enemies ADD COLUMN facing TEXT;
  ALTER TABLE encounter_enemies ADD COLUMN engine_profile_json TEXT;
  ALTER TABLE encounter_enemies ADD COLUMN character_id TEXT;

  CREATE TABLE IF NOT EXISTS encounter_rules (
    id              TEXT PRIMARY KEY,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id),
    rule_type       TEXT NOT NULL,
    rule_key        TEXT NOT NULL,
    rule_payload_json TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS encounter_exports (
    id              TEXT PRIMARY KEY,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id),
    project_id      TEXT NOT NULL REFERENCES projects(id),
    manifest_path   TEXT NOT NULL,
    content_hash    TEXT,
    format_version  TEXT NOT NULL DEFAULT '1.0',
    export_payload_json TEXT,
    is_canonical    INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS encounter_sync_receipts (
    id              TEXT PRIMARY KEY,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id),
    project_id      TEXT NOT NULL REFERENCES projects(id),
    target_path     TEXT NOT NULL,
    synced_files_json TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    receipt_hash    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS encounter_validation_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id    TEXT NOT NULL REFERENCES encounters(id),
    validation_type TEXT NOT NULL,
    result          TEXT NOT NULL,
    details_json    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_encounter_rules ON encounter_rules(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_encounter_exports ON encounter_exports(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_encounter_sync_receipts ON encounter_sync_receipts(encounter_id);
  CREATE INDEX IF NOT EXISTS idx_encounter_validation_runs ON encounter_validation_runs(encounter_id);
  `,

  // Version 4: Proof Lab + Freeze Orchestration
  `
  CREATE TABLE IF NOT EXISTS proof_suites (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    suite_key       TEXT NOT NULL,
    scope_type      TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    description     TEXT,
    is_blocking     INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proof_runs (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    suite_id        TEXT REFERENCES proof_suites(id),
    scope_type      TEXT NOT NULL,
    scope_id        TEXT NOT NULL,
    result          TEXT NOT NULL,
    blocking_failures INTEGER NOT NULL DEFAULT 0,
    warning_count   INTEGER NOT NULL DEFAULT 0,
    receipt_hash    TEXT,
    summary         TEXT,
    details_json    TEXT,
    tool_name       TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS proof_assertions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    proof_run_id    TEXT NOT NULL REFERENCES proof_runs(id),
    assertion_key   TEXT NOT NULL,
    status          TEXT NOT NULL,
    message         TEXT,
    details_json    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS freeze_policies (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    scope_type      TEXT NOT NULL,
    scope_id        TEXT NOT NULL,
    policy_key      TEXT NOT NULL,
    policy_json     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS freeze_candidates (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    scope_type      TEXT NOT NULL,
    scope_id        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'candidate',
    blocking_reasons_json TEXT,
    warning_reasons_json TEXT,
    candidate_hash  TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS freeze_receipts (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    scope_type      TEXT NOT NULL,
    scope_id        TEXT NOT NULL,
    source_candidate_id TEXT REFERENCES freeze_candidates(id),
    receipt_hash    TEXT,
    freeze_summary  TEXT,
    details_json    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS regressions (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    scope_type      TEXT NOT NULL,
    scope_id        TEXT NOT NULL,
    regression_type TEXT NOT NULL,
    from_run_id     TEXT REFERENCES proof_runs(id),
    to_run_id       TEXT REFERENCES proof_runs(id),
    severity        TEXT NOT NULL DEFAULT 'critical',
    details_json    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_proof_runs_scope ON proof_runs(scope_type, scope_id);
  CREATE INDEX IF NOT EXISTS idx_proof_runs_suite ON proof_runs(suite_id);
  CREATE INDEX IF NOT EXISTS idx_proof_assertions_run ON proof_assertions(proof_run_id);
  CREATE INDEX IF NOT EXISTS idx_freeze_policies_scope ON freeze_policies(scope_type, scope_id);
  CREATE INDEX IF NOT EXISTS idx_freeze_candidates_scope ON freeze_candidates(scope_type, scope_id);
  CREATE INDEX IF NOT EXISTS idx_freeze_receipts_scope ON freeze_receipts(scope_type, scope_id);
  CREATE INDEX IF NOT EXISTS idx_regressions_scope ON regressions(scope_type, scope_id);
  `,

  // Version 5: Canon Layer + Obsidian Integration
  `
  CREATE TABLE IF NOT EXISTS canon_pages (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    canon_id        TEXT NOT NULL UNIQUE,
    kind            TEXT NOT NULL,
    title           TEXT NOT NULL,
    vault_path      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'registered',
    content_hash    TEXT,
    frontmatter_json TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS canon_links (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    source_canon_id TEXT NOT NULL,
    target_type     TEXT NOT NULL,
    target_id       TEXT NOT NULL,
    link_type       TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS canon_snapshots (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    canon_id        TEXT NOT NULL,
    content_hash    TEXT NOT NULL,
    parsed_body_json TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS canon_drift_reports (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    scope_type      TEXT NOT NULL,
    scope_id        TEXT NOT NULL,
    result          TEXT NOT NULL,
    details_json    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS handoff_artifacts (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    scope_type      TEXT NOT NULL,
    scope_id        TEXT NOT NULL,
    artifact_type   TEXT NOT NULL,
    output_path     TEXT,
    content_hash    TEXT,
    details_json    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_canon_pages_project ON canon_pages(project_id);
  CREATE INDEX IF NOT EXISTS idx_canon_pages_kind ON canon_pages(kind);
  CREATE INDEX IF NOT EXISTS idx_canon_pages_canon_id ON canon_pages(canon_id);
  CREATE INDEX IF NOT EXISTS idx_canon_links_source ON canon_links(source_canon_id);
  CREATE INDEX IF NOT EXISTS idx_canon_links_target ON canon_links(target_type, target_id);
  CREATE INDEX IF NOT EXISTS idx_canon_snapshots_canon ON canon_snapshots(canon_id);
  CREATE INDEX IF NOT EXISTS idx_canon_drift_scope ON canon_drift_reports(scope_type, scope_id);
  CREATE INDEX IF NOT EXISTS idx_handoff_scope ON handoff_artifacts(scope_type, scope_id);
  `,

  // Version 6: Studio Bootstrap + Project Templates
  `
  CREATE TABLE IF NOT EXISTS project_templates (
    id              TEXT PRIMARY KEY,
    template_key    TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    engine          TEXT NOT NULL DEFAULT 'godot',
    genre_profile   TEXT,
    version         TEXT NOT NULL DEFAULT '1.0.0',
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_bootstraps (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    template_id     TEXT REFERENCES project_templates(id),
    bootstrap_mode  TEXT NOT NULL DEFAULT 'combat_first',
    target_path     TEXT NOT NULL,
    result          TEXT NOT NULL DEFAULT 'pending',
    details_json    TEXT,
    receipt_hash    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bootstrap_artifacts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_bootstrap_id TEXT NOT NULL REFERENCES project_bootstraps(id),
    artifact_type   TEXT NOT NULL,
    path            TEXT NOT NULL,
    content_hash    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS template_policies (
    id              TEXT PRIMARY KEY,
    template_id     TEXT NOT NULL REFERENCES project_templates(id),
    policy_key      TEXT NOT NULL,
    policy_json     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_project_bootstraps ON project_bootstraps(project_id);
  CREATE INDEX IF NOT EXISTS idx_bootstrap_artifacts ON bootstrap_artifacts(project_bootstrap_id);
  CREATE INDEX IF NOT EXISTS idx_template_policies ON template_policies(template_id);
  `,

  // Version 7: Repair Closure Spine — plans, receipts, regressions
  `
  CREATE TABLE IF NOT EXISTS repair_plans (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id),
    finding_ids_json    TEXT NOT NULL,
    action_key          TEXT NOT NULL,
    target              TEXT NOT NULL,
    mode                TEXT NOT NULL DEFAULT 'planned',
    plan_fingerprint    TEXT NOT NULL,
    steps_json          TEXT NOT NULL,
    expected_effects_json TEXT,
    preconditions_json  TEXT,
    status              TEXT NOT NULL DEFAULT 'planned',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS repair_receipts (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id),
    plan_id             TEXT NOT NULL REFERENCES repair_plans(id),
    action_key          TEXT NOT NULL,
    mode                TEXT NOT NULL,
    before_json         TEXT,
    after_json          TEXT,
    changed_targets_json TEXT,
    step_results_json   TEXT NOT NULL,
    verification_json   TEXT,
    status_delta_json   TEXT,
    receipt_hash        TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS repair_regressions (
    id                  TEXT PRIMARY KEY,
    project_id          TEXT NOT NULL REFERENCES projects(id),
    receipt_id          TEXT NOT NULL REFERENCES repair_receipts(id),
    regression_type     TEXT NOT NULL,
    severity            TEXT NOT NULL DEFAULT 'major',
    details_json        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_repair_plans_project ON repair_plans(project_id);
  CREATE INDEX IF NOT EXISTS idx_repair_plans_status ON repair_plans(status);
  CREATE INDEX IF NOT EXISTS idx_repair_receipts_plan ON repair_receipts(plan_id);
  CREATE INDEX IF NOT EXISTS idx_repair_receipts_project ON repair_receipts(project_id);
  CREATE INDEX IF NOT EXISTS idx_repair_regressions_receipt ON repair_regressions(receipt_id);
  `,

  // Version 8: Adoption + Quality Spine
  `
  ALTER TABLE repair_plans ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'not_required';
  ALTER TABLE repair_plans ADD COLUMN approved_by TEXT;
  ALTER TABLE repair_plans ADD COLUMN approved_at TEXT;
  ALTER TABLE repair_plans ADD COLUMN risk_class TEXT NOT NULL DEFAULT 'safe_auto';

  CREATE TABLE IF NOT EXISTS quality_domain_states (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    domain          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'unknown',
    blocker_count   INTEGER NOT NULL DEFAULT 0,
    warning_count   INTEGER NOT NULL DEFAULT 0,
    finding_ids_json TEXT,
    next_action     TEXT,
    computed_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS adoption_plans (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES projects(id),
    profile         TEXT NOT NULL,
    current_stage   INTEGER NOT NULL DEFAULT 1,
    stages_json     TEXT NOT NULL,
    completion_json TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_quality_domain_project ON quality_domain_states(project_id);
  CREATE INDEX IF NOT EXISTS idx_quality_domain_lookup ON quality_domain_states(project_id, domain);
  CREATE INDEX IF NOT EXISTS idx_adoption_plans_project ON adoption_plans(project_id);
  `,
];

export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Check current version
  const hasTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
  ).get();

  let currentVersion = 0;
  if (hasTable) {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as
      | { version: number }
      | undefined;
    currentVersion = row?.version ?? 0;
  }

  // Run pending migrations
  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    db.exec(MIGRATIONS[i]);
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(i + 1);
  }
}

export { SCHEMA_VERSION };
