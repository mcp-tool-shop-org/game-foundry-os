import type Database from 'better-sqlite3';
import type {
  BattleSceneContractRow,
  CombatUILayerRow,
  BattleSceneSnapshotRow,
  PlaytestSessionRow,
  BattleSceneProductionState,
  CombatUILayerKey,
  BattleSnapshotKey,
  PlaytestSessionState,
  PlaytestVerdict,
} from '../types.js';

// ─── Battle Scene Contracts ──────────────────────────────

export interface CreateSceneContractInput {
  id: string;
  project_id: string;
  encounter_id: string;
  scene_key: string;
  board_rows: number;
  board_cols: number;
  tile_size_px?: number;
  board_origin_x?: number;
  board_origin_y?: number;
  viewport_width?: number;
  viewport_height?: number;
  camera_zoom?: number;
  sprite_target_size?: number;
  unit_tile_ratio_min?: number;
  unit_tile_ratio_max?: number;
  hud_zones_json?: string;
  overlay_order_json?: string;
  min_unit_contrast?: number;
  max_hud_overlap_pct?: number;
}

export function upsertSceneContract(db: Database.Database, input: CreateSceneContractInput): BattleSceneContractRow {
  db.prepare(`
    INSERT INTO battle_scene_contracts (
      id, project_id, encounter_id, scene_key,
      board_rows, board_cols, tile_size_px, board_origin_x, board_origin_y,
      viewport_width, viewport_height, camera_zoom,
      sprite_target_size, unit_tile_ratio_min, unit_tile_ratio_max,
      hud_zones_json, overlay_order_json,
      min_unit_contrast, max_hud_overlap_pct
    ) VALUES (
      @id, @project_id, @encounter_id, @scene_key,
      @board_rows, @board_cols, @tile_size_px, @board_origin_x, @board_origin_y,
      @viewport_width, @viewport_height, @camera_zoom,
      @sprite_target_size, @unit_tile_ratio_min, @unit_tile_ratio_max,
      @hud_zones_json, @overlay_order_json,
      @min_unit_contrast, @max_hud_overlap_pct
    )
    ON CONFLICT(id) DO UPDATE SET
      scene_key = excluded.scene_key,
      board_rows = excluded.board_rows,
      board_cols = excluded.board_cols,
      tile_size_px = excluded.tile_size_px,
      board_origin_x = excluded.board_origin_x,
      board_origin_y = excluded.board_origin_y,
      viewport_width = excluded.viewport_width,
      viewport_height = excluded.viewport_height,
      camera_zoom = excluded.camera_zoom,
      sprite_target_size = excluded.sprite_target_size,
      unit_tile_ratio_min = excluded.unit_tile_ratio_min,
      unit_tile_ratio_max = excluded.unit_tile_ratio_max,
      hud_zones_json = excluded.hud_zones_json,
      overlay_order_json = excluded.overlay_order_json,
      min_unit_contrast = excluded.min_unit_contrast,
      max_hud_overlap_pct = excluded.max_hud_overlap_pct,
      updated_at = datetime('now')
  `).run({
    id: input.id,
    project_id: input.project_id,
    encounter_id: input.encounter_id,
    scene_key: input.scene_key,
    board_rows: input.board_rows,
    board_cols: input.board_cols,
    tile_size_px: input.tile_size_px ?? 64,
    board_origin_x: input.board_origin_x ?? 128,
    board_origin_y: input.board_origin_y ?? 96,
    viewport_width: input.viewport_width ?? 1280,
    viewport_height: input.viewport_height ?? 720,
    camera_zoom: input.camera_zoom ?? 1.0,
    sprite_target_size: input.sprite_target_size ?? 48,
    unit_tile_ratio_min: input.unit_tile_ratio_min ?? 0.5,
    unit_tile_ratio_max: input.unit_tile_ratio_max ?? 1.2,
    hud_zones_json: input.hud_zones_json ?? null,
    overlay_order_json: input.overlay_order_json ?? null,
    min_unit_contrast: input.min_unit_contrast ?? 40.0,
    max_hud_overlap_pct: input.max_hud_overlap_pct ?? 0.15,
  });

  return db.prepare('SELECT * FROM battle_scene_contracts WHERE id = ?').get(input.id) as BattleSceneContractRow;
}

export function getSceneContract(db: Database.Database, id: string): BattleSceneContractRow | undefined {
  return db.prepare('SELECT * FROM battle_scene_contracts WHERE id = ?').get(id) as BattleSceneContractRow | undefined;
}

export function getSceneContractByEncounter(db: Database.Database, encounterId: string): BattleSceneContractRow | undefined {
  return db.prepare('SELECT * FROM battle_scene_contracts WHERE encounter_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(encounterId) as BattleSceneContractRow | undefined;
}

export function updateSceneContractState(db: Database.Database, id: string, state: BattleSceneProductionState): void {
  db.prepare("UPDATE battle_scene_contracts SET production_state = ?, updated_at = datetime('now') WHERE id = ?")
    .run(state, id);
}

export function listSceneContracts(db: Database.Database, projectId: string): BattleSceneContractRow[] {
  return db.prepare('SELECT * FROM battle_scene_contracts WHERE project_id = ? ORDER BY created_at')
    .all(projectId) as BattleSceneContractRow[];
}

// ─── Combat UI Layers ────────────────────────────────────

export interface CreateUILayerInput {
  id: string;
  contract_id: string;
  layer_key: CombatUILayerKey;
  display_name: string;
  z_order: number;
  activation: string;
  shows_json: string;
  color_scheme_json?: string;
  icon_set?: string;
  required_data_fields?: string;
  legibility_min_size?: number;
}

export function insertUILayer(db: Database.Database, input: CreateUILayerInput): CombatUILayerRow {
  db.prepare(`
    INSERT INTO combat_ui_layers (
      id, contract_id, layer_key, display_name, z_order, activation,
      shows_json, color_scheme_json, icon_set, required_data_fields, legibility_min_size
    ) VALUES (
      @id, @contract_id, @layer_key, @display_name, @z_order, @activation,
      @shows_json, @color_scheme_json, @icon_set, @required_data_fields, @legibility_min_size
    )
  `).run({
    id: input.id,
    contract_id: input.contract_id,
    layer_key: input.layer_key,
    display_name: input.display_name,
    z_order: input.z_order,
    activation: input.activation,
    shows_json: input.shows_json,
    color_scheme_json: input.color_scheme_json ?? null,
    icon_set: input.icon_set ?? null,
    required_data_fields: input.required_data_fields ?? null,
    legibility_min_size: input.legibility_min_size ?? 16,
  });

  return db.prepare('SELECT * FROM combat_ui_layers WHERE id = ?').get(input.id) as CombatUILayerRow;
}

export function getLayersByContract(db: Database.Database, contractId: string): CombatUILayerRow[] {
  return db.prepare('SELECT * FROM combat_ui_layers WHERE contract_id = ? ORDER BY z_order')
    .all(contractId) as CombatUILayerRow[];
}

export function clearLayersByContract(db: Database.Database, contractId: string): void {
  db.prepare('DELETE FROM combat_ui_layers WHERE contract_id = ?').run(contractId);
}

// ─── Battle Scene Snapshots ──────────────────────────────

export interface CreateSnapshotInput {
  id: string;
  contract_id: string;
  snapshot_key: BattleSnapshotKey;
  state_desc_json: string;
  layout_json: string;
  screenshot_path?: string;
  content_hash?: string;
  proof_run_id?: string;
}

export function insertSnapshot(db: Database.Database, input: CreateSnapshotInput): BattleSceneSnapshotRow {
  db.prepare(`
    INSERT OR REPLACE INTO battle_scene_snapshots (
      id, contract_id, snapshot_key, state_desc_json, layout_json,
      screenshot_path, content_hash, proof_run_id
    ) VALUES (
      @id, @contract_id, @snapshot_key, @state_desc_json, @layout_json,
      @screenshot_path, @content_hash, @proof_run_id
    )
  `).run({
    id: input.id,
    contract_id: input.contract_id,
    snapshot_key: input.snapshot_key,
    state_desc_json: input.state_desc_json,
    layout_json: input.layout_json,
    screenshot_path: input.screenshot_path ?? null,
    content_hash: input.content_hash ?? null,
    proof_run_id: input.proof_run_id ?? null,
  });

  return db.prepare('SELECT * FROM battle_scene_snapshots WHERE id = ?').get(input.id) as BattleSceneSnapshotRow;
}

export function getSnapshotsByContract(db: Database.Database, contractId: string): BattleSceneSnapshotRow[] {
  return db.prepare('SELECT * FROM battle_scene_snapshots WHERE contract_id = ? ORDER BY snapshot_key')
    .all(contractId) as BattleSceneSnapshotRow[];
}

// ─── Playtest Sessions ───────────────────────────────────

export interface CreatePlaytestInput {
  id: string;
  project_id: string;
  encounter_id: string;
  contract_id?: string;
}

export function insertPlaytestSession(db: Database.Database, input: CreatePlaytestInput): PlaytestSessionRow {
  db.prepare(`
    INSERT INTO playtest_sessions (id, project_id, encounter_id, contract_id)
    VALUES (@id, @project_id, @encounter_id, @contract_id)
  `).run({
    id: input.id,
    project_id: input.project_id,
    encounter_id: input.encounter_id,
    contract_id: input.contract_id ?? null,
  });

  return db.prepare('SELECT * FROM playtest_sessions WHERE id = ?').get(input.id) as PlaytestSessionRow;
}

export function updatePlaytestSession(
  db: Database.Database,
  id: string,
  updates: {
    session_state?: PlaytestSessionState;
    snapshots_captured?: number;
    read_failures?: number;
    failures_json?: string;
    quality_verdict?: PlaytestVerdict;
    notes?: string;
    completed_at?: string;
  },
): PlaytestSessionRow {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  if (fields.length > 0) {
    db.prepare(`UPDATE playtest_sessions SET ${fields.join(', ')} WHERE id = @id`).run(params);
  }

  return db.prepare('SELECT * FROM playtest_sessions WHERE id = ?').get(id) as PlaytestSessionRow;
}

export function getPlaytestSession(db: Database.Database, id: string): PlaytestSessionRow | undefined {
  return db.prepare('SELECT * FROM playtest_sessions WHERE id = ?').get(id) as PlaytestSessionRow | undefined;
}

export function listPlaytestSessions(db: Database.Database, encounterId: string): PlaytestSessionRow[] {
  return db.prepare('SELECT * FROM playtest_sessions WHERE encounter_id = ? ORDER BY started_at DESC')
    .all(encounterId) as PlaytestSessionRow[];
}
