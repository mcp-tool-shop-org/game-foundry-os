import type Database from 'better-sqlite3';
import type {
  ChapterAuthoringDefaultsRow,
  ChapterScaffoldReceiptRow,
} from '../types.js';

// ─── Authoring Defaults CRUD ──────────────────────────────

export interface UpsertAuthoringDefaultsInput {
  chapter_id: string;
  project_id: string;
  default_grid_rows?: number;
  default_grid_cols?: number;
  default_encounter_type?: string;
  default_max_turns?: number | null;
  default_tile_size_px?: number;
  default_viewport_width?: number;
  default_viewport_height?: number;
  require_scene_contract?: boolean;
  require_ui_layers?: boolean;
  require_proof_pass?: boolean;
  require_playtest_pass?: boolean;
  require_canon_link?: boolean;
}

export function upsertAuthoringDefaults(
  db: Database.Database,
  input: UpsertAuthoringDefaultsInput,
): ChapterAuthoringDefaultsRow {
  db.prepare(`
    INSERT INTO chapter_authoring_defaults (
      chapter_id, project_id,
      default_grid_rows, default_grid_cols, default_encounter_type, default_max_turns,
      default_tile_size_px, default_viewport_width, default_viewport_height,
      require_scene_contract, require_ui_layers, require_proof_pass,
      require_playtest_pass, require_canon_link
    ) VALUES (
      @chapter_id, @project_id,
      @default_grid_rows, @default_grid_cols, @default_encounter_type, @default_max_turns,
      @default_tile_size_px, @default_viewport_width, @default_viewport_height,
      @require_scene_contract, @require_ui_layers, @require_proof_pass,
      @require_playtest_pass, @require_canon_link
    )
    ON CONFLICT(chapter_id) DO UPDATE SET
      default_grid_rows = COALESCE(excluded.default_grid_rows, chapter_authoring_defaults.default_grid_rows),
      default_grid_cols = COALESCE(excluded.default_grid_cols, chapter_authoring_defaults.default_grid_cols),
      default_encounter_type = COALESCE(excluded.default_encounter_type, chapter_authoring_defaults.default_encounter_type),
      default_max_turns = excluded.default_max_turns,
      default_tile_size_px = COALESCE(excluded.default_tile_size_px, chapter_authoring_defaults.default_tile_size_px),
      default_viewport_width = COALESCE(excluded.default_viewport_width, chapter_authoring_defaults.default_viewport_width),
      default_viewport_height = COALESCE(excluded.default_viewport_height, chapter_authoring_defaults.default_viewport_height),
      require_scene_contract = COALESCE(excluded.require_scene_contract, chapter_authoring_defaults.require_scene_contract),
      require_ui_layers = COALESCE(excluded.require_ui_layers, chapter_authoring_defaults.require_ui_layers),
      require_proof_pass = COALESCE(excluded.require_proof_pass, chapter_authoring_defaults.require_proof_pass),
      require_playtest_pass = COALESCE(excluded.require_playtest_pass, chapter_authoring_defaults.require_playtest_pass),
      require_canon_link = COALESCE(excluded.require_canon_link, chapter_authoring_defaults.require_canon_link),
      updated_at = datetime('now')
  `).run({
    chapter_id: input.chapter_id,
    project_id: input.project_id,
    default_grid_rows: input.default_grid_rows ?? 3,
    default_grid_cols: input.default_grid_cols ?? 8,
    default_encounter_type: input.default_encounter_type ?? 'standard',
    default_max_turns: input.default_max_turns ?? null,
    default_tile_size_px: input.default_tile_size_px ?? 64,
    default_viewport_width: input.default_viewport_width ?? 1280,
    default_viewport_height: input.default_viewport_height ?? 720,
    require_scene_contract: input.require_scene_contract === undefined ? 1 : (input.require_scene_contract ? 1 : 0),
    require_ui_layers: input.require_ui_layers === undefined ? 1 : (input.require_ui_layers ? 1 : 0),
    require_proof_pass: input.require_proof_pass === undefined ? 1 : (input.require_proof_pass ? 1 : 0),
    require_playtest_pass: input.require_playtest_pass === undefined ? 0 : (input.require_playtest_pass ? 1 : 0),
    require_canon_link: input.require_canon_link === undefined ? 0 : (input.require_canon_link ? 1 : 0),
  });

  return db.prepare('SELECT * FROM chapter_authoring_defaults WHERE chapter_id = ?')
    .get(input.chapter_id) as ChapterAuthoringDefaultsRow;
}

export function getAuthoringDefaults(
  db: Database.Database,
  chapterId: string,
): ChapterAuthoringDefaultsRow | undefined {
  return db.prepare('SELECT * FROM chapter_authoring_defaults WHERE chapter_id = ?')
    .get(chapterId) as ChapterAuthoringDefaultsRow | undefined;
}

// ─── Scaffold Receipts ────────────────────────────────────

export interface InsertScaffoldReceiptInput {
  id: string;
  chapter_id: string;
  project_id: string;
  input_brief_json: string;
  encounters_created: number;
  scene_contracts_created: number;
  layers_configured: number;
  receipt_hash?: string;
}

export function insertScaffoldReceipt(
  db: Database.Database,
  input: InsertScaffoldReceiptInput,
): ChapterScaffoldReceiptRow {
  db.prepare(`
    INSERT INTO chapter_scaffold_receipts (
      id, chapter_id, project_id, input_brief_json,
      encounters_created, scene_contracts_created, layers_configured, receipt_hash
    ) VALUES (
      @id, @chapter_id, @project_id, @input_brief_json,
      @encounters_created, @scene_contracts_created, @layers_configured, @receipt_hash
    )
  `).run({
    id: input.id,
    chapter_id: input.chapter_id,
    project_id: input.project_id,
    input_brief_json: input.input_brief_json,
    encounters_created: input.encounters_created,
    scene_contracts_created: input.scene_contracts_created,
    layers_configured: input.layers_configured,
    receipt_hash: input.receipt_hash ?? null,
  });

  return db.prepare('SELECT * FROM chapter_scaffold_receipts WHERE id = ?')
    .get(input.id) as ChapterScaffoldReceiptRow;
}

export function getScaffoldReceipts(
  db: Database.Database,
  chapterId: string,
): ChapterScaffoldReceiptRow[] {
  return db.prepare('SELECT * FROM chapter_scaffold_receipts WHERE chapter_id = ? ORDER BY created_at DESC')
    .all(chapterId) as ChapterScaffoldReceiptRow[];
}
