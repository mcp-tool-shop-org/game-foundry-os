import type Database from 'better-sqlite3';

const SCHEMA_VERSION = 2;

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
