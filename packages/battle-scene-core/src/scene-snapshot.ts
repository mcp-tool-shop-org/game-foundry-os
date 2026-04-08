import type Database from 'better-sqlite3';
import type {
  BattleSceneSnapshotRow,
  BattleSnapshotKey,
  CombatUILayerKey,
  HudZone,
} from '@mcptoolshop/game-foundry-registry';
import {
  getSceneContract,
  getEncounterEnemies,
  getLayersByContract,
  insertSnapshot,
  getSnapshotsByContract,
} from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

/** Unit position in pixel space */
export interface UnitLayout {
  enemy_id: number;
  display_name: string;
  grid_row: number;
  grid_col: number;
  pixel_x: number;
  pixel_y: number;
  pixel_center_x: number;
  pixel_center_y: number;
}

/** Full snapshot layout */
export interface SnapshotLayout {
  units: UnitLayout[];
  active_layers: CombatUILayerKey[];
  hud_zones: HudZone[];
  board_rect: { x: number; y: number; w: number; h: number };
}

/** What each canonical snapshot state looks like */
const SNAPSHOT_LAYER_MAP: Record<BattleSnapshotKey, { layers_active: CombatUILayerKey[]; description: string }> = {
  neutral: {
    layers_active: ['planning_undo'],
    description: 'Board at rest, no combat overlays active',
  },
  threat_on: {
    layers_active: ['intent', 'threat', 'planning_undo'],
    description: 'Threat zones visible, enemy intent telegraphed',
  },
  forecast: {
    layers_active: ['intent', 'forecast', 'planning_undo'],
    description: 'Player selecting action, forecast layer showing outcomes',
  },
  enemy_turn: {
    layers_active: ['intent', 'planning_undo'],
    description: 'Enemy turn — intent visible, player reading enemy moves',
  },
  pre_commit: {
    layers_active: ['intent', 'forecast', 'planning_undo'],
    description: 'Action queued, undo available, commit button shown',
  },
};

/**
 * Capture a canonical battle state snapshot.
 * Computes unit positions in pixel space from contract + encounter roster.
 */
export function captureSnapshot(
  db: Database.Database,
  contractId: string,
  snapshotKey: BattleSnapshotKey,
): BattleSceneSnapshotRow {
  const contract = getSceneContract(db, contractId);
  if (!contract) throw new Error(`Scene contract not found: ${contractId}`);

  const enemies = getEncounterEnemies(db, contract.encounter_id);
  const layers = getLayersByContract(db, contractId);

  const snapshotDef = SNAPSHOT_LAYER_MAP[snapshotKey];

  // Compute unit positions in pixel space
  const units: UnitLayout[] = enemies.map(e => {
    const px = contract.board_origin_x + e.grid_col * contract.tile_size_px;
    const py = contract.board_origin_y + e.grid_row * contract.tile_size_px;
    return {
      enemy_id: e.id,
      display_name: e.display_name,
      grid_row: e.grid_row,
      grid_col: e.grid_col,
      pixel_x: px,
      pixel_y: py,
      pixel_center_x: px + contract.tile_size_px / 2,
      pixel_center_y: py + contract.tile_size_px / 2,
    };
  });

  const hudZones: HudZone[] = contract.hud_zones_json ? JSON.parse(contract.hud_zones_json) : [];

  const layout: SnapshotLayout = {
    units,
    active_layers: snapshotDef.layers_active,
    hud_zones: hudZones,
    board_rect: {
      x: contract.board_origin_x,
      y: contract.board_origin_y,
      w: contract.board_cols * contract.tile_size_px,
      h: contract.board_rows * contract.tile_size_px,
    },
  };

  const stateDesc = {
    layers_active: snapshotDef.layers_active,
    description: snapshotDef.description,
    unit_count: enemies.length,
    layer_count: layers.length,
  };

  const id = `ss_${crypto.randomUUID().slice(0, 12)}`;

  return insertSnapshot(db, {
    id,
    contract_id: contractId,
    snapshot_key: snapshotKey,
    state_desc_json: JSON.stringify(stateDesc),
    layout_json: JSON.stringify(layout),
  });
}

/**
 * Capture all 5 canonical snapshots for a contract.
 */
export function captureAllSnapshots(
  db: Database.Database,
  contractId: string,
): BattleSceneSnapshotRow[] {
  const keys: BattleSnapshotKey[] = ['neutral', 'threat_on', 'forecast', 'enemy_turn', 'pre_commit'];
  return keys.map(key => captureSnapshot(db, contractId, key));
}

/**
 * List all snapshots for a contract.
 */
export function listSnapshots(
  db: Database.Database,
  contractId: string,
): BattleSceneSnapshotRow[] {
  return getSnapshotsByContract(db, contractId);
}
