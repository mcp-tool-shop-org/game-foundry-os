import type Database from 'better-sqlite3';
import type {
  BattleSceneContractRow,
  BattleSceneProductionState,
  EncounterRow,
  HudZone,
} from '@mcptoolshop/game-foundry-registry';
import {
  upsertSceneContract,
  getSceneContract,
  getSceneContractByEncounter,
  updateSceneContractState,
  getEncounter,
} from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

/** Default overlay order matching the 5 combat UI layers */
const DEFAULT_OVERLAY_ORDER = ['intent', 'threat', 'forecast', 'terrain', 'planning_undo'];

/** Default HUD zones for a 1280x720 viewport */
const DEFAULT_HUD_ZONES: HudZone[] = [
  { name: 'turn_order', x: 0, y: 0, w: 200, h: 64 },
  { name: 'action_menu', x: 960, y: 520, w: 320, h: 200 },
  { name: 'unit_status', x: 0, y: 600, w: 400, h: 120 },
];

/** Legal forward transitions for battle scene production state */
const TRANSITIONS: Record<BattleSceneProductionState, BattleSceneProductionState[]> = {
  draft: ['contract_defined'],
  contract_defined: ['layers_configured'],
  layers_configured: ['snapshots_captured'],
  snapshots_captured: ['proof_passed'],
  proof_passed: ['frozen'],
  frozen: [],
};

/**
 * Create a scene contract from an encounter, pulling defaults from encounter grid dimensions.
 */
export function createSceneContract(
  db: Database.Database,
  projectId: string,
  encounterId: string,
  overrides?: Partial<{
    tile_size_px: number;
    board_origin_x: number;
    board_origin_y: number;
    viewport_width: number;
    viewport_height: number;
    camera_zoom: number;
    sprite_target_size: number;
    unit_tile_ratio_min: number;
    unit_tile_ratio_max: number;
    hud_zones: HudZone[];
    overlay_order: string[];
    min_unit_contrast: number;
    max_hud_overlap_pct: number;
  }>,
): BattleSceneContractRow {
  const encounter = getEncounter(db, encounterId);
  if (!encounter) {
    throw new Error(`Encounter not found: ${encounterId}`);
  }

  const id = `bsc_${crypto.randomUUID().slice(0, 12)}`;
  const sceneKey = `${encounter.chapter}_${encounter.id}`;

  const hudZones = overrides?.hud_zones ?? DEFAULT_HUD_ZONES;
  const overlayOrder = overrides?.overlay_order ?? DEFAULT_OVERLAY_ORDER;

  return upsertSceneContract(db, {
    id,
    project_id: projectId,
    encounter_id: encounterId,
    scene_key: sceneKey,
    board_rows: encounter.grid_rows,
    board_cols: encounter.grid_cols,
    tile_size_px: overrides?.tile_size_px ?? 64,
    board_origin_x: overrides?.board_origin_x ?? 128,
    board_origin_y: overrides?.board_origin_y ?? 96,
    viewport_width: overrides?.viewport_width ?? 1280,
    viewport_height: overrides?.viewport_height ?? 720,
    camera_zoom: overrides?.camera_zoom ?? 1.0,
    sprite_target_size: overrides?.sprite_target_size ?? 48,
    unit_tile_ratio_min: overrides?.unit_tile_ratio_min ?? 0.5,
    unit_tile_ratio_max: overrides?.unit_tile_ratio_max ?? 1.2,
    hud_zones_json: JSON.stringify(hudZones),
    overlay_order_json: JSON.stringify(overlayOrder),
    min_unit_contrast: overrides?.min_unit_contrast ?? 40.0,
    max_hud_overlap_pct: overrides?.max_hud_overlap_pct ?? 0.15,
  });
}

/**
 * Validate that the scene contract is internally consistent.
 */
export interface ContractValidationResult {
  pass: boolean;
  checks: Array<{ check: string; pass: boolean; detail: string }>;
}

export function validateSceneContract(
  db: Database.Database,
  contractId: string,
): ContractValidationResult {
  const contract = getSceneContract(db, contractId);
  if (!contract) throw new Error(`Scene contract not found: ${contractId}`);

  const encounter = getEncounter(db, contract.encounter_id);
  if (!encounter) throw new Error(`Encounter not found: ${contract.encounter_id}`);

  const checks: Array<{ check: string; pass: boolean; detail: string }> = [];

  // Check 1: Board dimensions match encounter
  const dimsMatch = contract.board_rows === encounter.grid_rows && contract.board_cols === encounter.grid_cols;
  checks.push({
    check: 'board_matches_encounter',
    pass: dimsMatch,
    detail: dimsMatch
      ? `Board ${contract.board_rows}x${contract.board_cols} matches encounter grid`
      : `Board ${contract.board_rows}x${contract.board_cols} != encounter ${encounter.grid_rows}x${encounter.grid_cols}`,
  });

  // Check 2: Board fits within viewport
  const boardWidth = contract.board_origin_x + contract.board_cols * contract.tile_size_px;
  const boardHeight = contract.board_origin_y + contract.board_rows * contract.tile_size_px;
  const boardFits = boardWidth <= contract.viewport_width && boardHeight <= contract.viewport_height;
  checks.push({
    check: 'board_fits_viewport',
    pass: boardFits,
    detail: boardFits
      ? `Board ${boardWidth}x${boardHeight} fits viewport ${contract.viewport_width}x${contract.viewport_height}`
      : `Board ${boardWidth}x${boardHeight} exceeds viewport ${contract.viewport_width}x${contract.viewport_height}`,
  });

  // Check 3: Sprite-to-tile ratio is reasonable
  const ratio = contract.sprite_target_size / contract.tile_size_px;
  const ratioOk = ratio >= contract.unit_tile_ratio_min && ratio <= contract.unit_tile_ratio_max;
  checks.push({
    check: 'sprite_tile_ratio',
    pass: ratioOk,
    detail: ratioOk
      ? `Sprite/tile ratio ${ratio.toFixed(2)} in range [${contract.unit_tile_ratio_min}, ${contract.unit_tile_ratio_max}]`
      : `Sprite/tile ratio ${ratio.toFixed(2)} outside [${contract.unit_tile_ratio_min}, ${contract.unit_tile_ratio_max}]`,
  });

  // Check 4: HUD overlap pressure — compute actual intersection of HUD zones with board rect
  const hudZones: HudZone[] = contract.hud_zones_json ? JSON.parse(contract.hud_zones_json) : [];
  const boardLeft = contract.board_origin_x;
  const boardTop = contract.board_origin_y;
  const boardRight = boardLeft + contract.board_cols * contract.tile_size_px;
  const boardBottom = boardTop + contract.board_rows * contract.tile_size_px;
  const boardArea = (boardRight - boardLeft) * (boardBottom - boardTop);

  let hudOverlapArea = 0;
  for (const z of hudZones) {
    const overlapLeft = Math.max(z.x, boardLeft);
    const overlapTop = Math.max(z.y, boardTop);
    const overlapRight = Math.min(z.x + z.w, boardRight);
    const overlapBottom = Math.min(z.y + z.h, boardBottom);
    if (overlapRight > overlapLeft && overlapBottom > overlapTop) {
      hudOverlapArea += (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
    }
  }
  const overlapPct = boardArea > 0 ? hudOverlapArea / boardArea : 0;
  const hudOk = overlapPct <= contract.max_hud_overlap_pct;
  checks.push({
    check: 'hud_overlap_pressure',
    pass: hudOk,
    detail: hudOk
      ? `HUD overlap ${(overlapPct * 100).toFixed(1)}% <= ${(contract.max_hud_overlap_pct * 100).toFixed(1)}% max`
      : `HUD overlap ${(overlapPct * 100).toFixed(1)}% exceeds ${(contract.max_hud_overlap_pct * 100).toFixed(1)}% max`,
  });

  // Check 5: Overlay order includes all 5 required layers
  const overlayOrder: string[] = contract.overlay_order_json ? JSON.parse(contract.overlay_order_json) : [];
  const required = ['intent', 'threat', 'forecast', 'terrain', 'planning_undo'];
  const allPresent = required.every(r => overlayOrder.includes(r));
  checks.push({
    check: 'overlay_order_complete',
    pass: allPresent,
    detail: allPresent
      ? 'All 5 required layers in overlay order'
      : `Missing layers: ${required.filter(r => !overlayOrder.includes(r)).join(', ')}`,
  });

  return { pass: checks.every(c => c.pass), checks };
}

/**
 * Transition the scene contract's production state forward.
 */
export function transitionSceneContractState(
  db: Database.Database,
  contractId: string,
  toState: BattleSceneProductionState,
  reason?: string,
): void {
  const contract = getSceneContract(db, contractId);
  if (!contract) throw new Error(`Scene contract not found: ${contractId}`);

  const fromState = contract.production_state as BattleSceneProductionState;
  const allowed = TRANSITIONS[fromState] ?? [];
  if (!allowed.includes(toState)) {
    throw new Error(`Cannot transition scene contract from '${fromState}' to '${toState}'`);
  }

  updateSceneContractState(db, contractId, toState);

  // Emit state event
  db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name)
    VALUES (?, 'battle_scene', ?, ?, ?, ?, 'scene_contract')
  `).run(contract.project_id, contractId, fromState, toState, reason ?? null);
}
