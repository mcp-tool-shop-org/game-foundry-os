import type Database from 'better-sqlite3';
import type {
  CombatUILayerRow,
  CombatUILayerKey,
  EncounterEnemyRow,
} from '@mcptoolshop/game-foundry-registry';
import {
  insertUILayer,
  getLayersByContract,
  clearLayersByContract,
  getSceneContract,
  getEncounterEnemies,
} from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

/** Default layer definitions — the 5 combat UI layers from the research */
interface LayerDefault {
  layer_key: CombatUILayerKey;
  display_name: string;
  z_order: number;
  activation: string;
  shows: Record<string, boolean>;
  required_fields: string[];
  legibility_min_size: number;
  color_scheme: { primary: string; secondary: string; opacity: number };
}

const LAYER_DEFAULTS: LayerDefault[] = [
  {
    layer_key: 'intent',
    display_name: 'Enemy Intent',
    z_order: 1,
    activation: 'always_on',
    shows: { targeted_tiles: true, attack_direction: true, knockback_destination: true, aoe_footprint: true },
    required_fields: ['facing', 'ai_role'],
    legibility_min_size: 16,
    color_scheme: { primary: '#FF4444', secondary: '#FF444488', opacity: 0.7 },
  },
  {
    layer_key: 'threat',
    display_name: 'Threat Zones',
    z_order: 2,
    activation: 'toggle',
    shows: { enemy_reach_tiles: true, attack_range_tiles: true, support_range_tiles: false },
    required_fields: ['move_range', 'speed'],
    legibility_min_size: 0,
    color_scheme: { primary: '#FF8800', secondary: '#FF880088', opacity: 0.5 },
  },
  {
    layer_key: 'forecast',
    display_name: 'Action Forecast',
    z_order: 3,
    activation: 'selection',
    shows: { expected_damage_range: true, retaliation_risk: true, status_effects: true, displacement_endpoint: true },
    required_fields: ['hp', 'guard'],
    legibility_min_size: 24,
    color_scheme: { primary: '#4488FF', secondary: '#4488FF88', opacity: 0.8 },
  },
  {
    layer_key: 'terrain',
    display_name: 'Terrain Read',
    z_order: 4,
    activation: 'toggle',
    shows: { terrain_type_icons: true, obstruction_lines: false, cover_indicators: false },
    required_fields: [],
    legibility_min_size: 12,
    color_scheme: { primary: '#44AA44', secondary: '#44AA4488', opacity: 0.6 },
  },
  {
    layer_key: 'planning_undo',
    display_name: 'Planning / Undo',
    z_order: 5,
    activation: 'always_on',
    shows: { action_queue_preview: true, undo_available_indicator: true, commit_button_visible: true, rewind_depth: true },
    required_fields: [],
    legibility_min_size: 20,
    color_scheme: { primary: '#FFFFFF', secondary: '#FFFFFF88', opacity: 0.9 },
  },
];

/**
 * Configure all 5 default combat UI layers for a scene contract.
 * Replaces any existing layers.
 */
export function configureDefaultLayers(
  db: Database.Database,
  contractId: string,
): CombatUILayerRow[] {
  const contract = getSceneContract(db, contractId);
  if (!contract) throw new Error(`Scene contract not found: ${contractId}`);

  clearLayersByContract(db, contractId);

  const layers: CombatUILayerRow[] = [];
  for (const def of LAYER_DEFAULTS) {
    const layer = insertUILayer(db, {
      id: `cul_${crypto.randomUUID().slice(0, 12)}`,
      contract_id: contractId,
      layer_key: def.layer_key,
      display_name: def.display_name,
      z_order: def.z_order,
      activation: def.activation,
      shows_json: JSON.stringify(def.shows),
      color_scheme_json: JSON.stringify(def.color_scheme),
      required_data_fields: JSON.stringify(def.required_fields),
      legibility_min_size: def.legibility_min_size,
    });
    layers.push(layer);
  }

  return layers;
}

/**
 * Configure a single custom layer (for overriding defaults).
 */
export function configureLayer(
  db: Database.Database,
  contractId: string,
  config: {
    layer_key: CombatUILayerKey;
    display_name?: string;
    z_order: number;
    activation?: string;
    shows?: Record<string, boolean>;
    required_fields?: string[];
    legibility_min_size?: number;
  },
): CombatUILayerRow {
  const def = LAYER_DEFAULTS.find(d => d.layer_key === config.layer_key);
  if (!def) throw new Error(`Unknown layer key: ${config.layer_key}`);

  return insertUILayer(db, {
    id: `cul_${crypto.randomUUID().slice(0, 12)}`,
    contract_id: contractId,
    layer_key: config.layer_key,
    display_name: config.display_name ?? def.display_name,
    z_order: config.z_order,
    activation: config.activation ?? def.activation,
    shows_json: JSON.stringify(config.shows ?? def.shows),
    required_data_fields: JSON.stringify(config.required_fields ?? def.required_fields),
    legibility_min_size: config.legibility_min_size ?? def.legibility_min_size,
  });
}

// ─── Validation ──────────────────────────────────────────

export interface LayerDependencyResult {
  layer_key: CombatUILayerKey;
  pass: boolean;
  missing_fields: Array<{ enemy_name: string; field: string }>;
}

export interface LayerValidationResult {
  pass: boolean;
  layers: LayerDependencyResult[];
  z_order_valid: boolean;
  z_order_conflicts: string[];
}

/**
 * Validate layer dependencies against the encounter's enemy roster data.
 */
export function validateLayerDependencies(
  db: Database.Database,
  contractId: string,
): LayerValidationResult {
  const contract = getSceneContract(db, contractId);
  if (!contract) throw new Error(`Scene contract not found: ${contractId}`);

  const layers = getLayersByContract(db, contractId);
  const enemies = getEncounterEnemies(db, contract.encounter_id);

  const layerResults: LayerDependencyResult[] = [];

  for (const layer of layers) {
    const requiredFields: string[] = layer.required_data_fields
      ? JSON.parse(layer.required_data_fields)
      : [];

    const missing: Array<{ enemy_name: string; field: string }> = [];

    for (const enemy of enemies) {
      for (const field of requiredFields) {
        const value = (enemy as unknown as Record<string, unknown>)[field];
        if (value === null || value === undefined) {
          missing.push({ enemy_name: enemy.display_name, field });
        }
      }
    }

    layerResults.push({
      layer_key: layer.layer_key as CombatUILayerKey,
      pass: missing.length === 0,
      missing_fields: missing,
    });
  }

  // Check z-order uniqueness
  const zOrders = layers.map(l => l.z_order);
  const uniqueZ = new Set(zOrders);
  const zOrderConflicts: string[] = [];
  if (uniqueZ.size < zOrders.length) {
    const seen = new Map<number, string>();
    for (const layer of layers) {
      if (seen.has(layer.z_order)) {
        zOrderConflicts.push(`z_order ${layer.z_order}: ${seen.get(layer.z_order)} and ${layer.layer_key}`);
      }
      seen.set(layer.z_order, layer.layer_key);
    }
  }

  const zOrderValid = zOrderConflicts.length === 0;
  const allLayersPass = layerResults.every(r => r.pass);

  return {
    pass: allLayersPass && zOrderValid,
    layers: layerResults,
    z_order_valid: zOrderValid,
    z_order_conflicts: zOrderConflicts,
  };
}

/**
 * Get all layers for a contract with their current state.
 */
export function getLayerStatus(
  db: Database.Database,
  contractId: string,
): CombatUILayerRow[] {
  return getLayersByContract(db, contractId);
}
