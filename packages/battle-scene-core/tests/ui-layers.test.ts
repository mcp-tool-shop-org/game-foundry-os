import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy, getLayersByContract, clearLayersByContract } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract,
  configureDefaultLayers,
  configureLayer,
  validateLayerDependencies,
  getLayerStatus,
} from '@mcptoolshop/battle-scene-core';

let db: Database.Database;

function seedEncounterWithEnemies(opts?: {
  facing?: string | null;
  ai_role?: string | null;
  move_range?: number | null;
  speed?: number | null;
  hp?: number | null;
  guard?: number | null;
}) {
  upsertProject(db, 'proj-ul', 'UI Layers Project', '/tmp/ul');
  upsertEncounter(db, {
    id: 'enc-ul',
    project_id: 'proj-ul',
    chapter: 'ch1',
    label: 'Layer Test Encounter',
    grid_rows: 3,
    grid_cols: 8,
  });
  addEnemy(db, {
    encounter_id: 'enc-ul',
    display_name: 'Goblin Archer',
    variant_id: 'goblin_archer_base',
    sprite_pack: 'goblin_enemies',
    grid_row: 1,
    grid_col: 2,
    ai_role: opts?.ai_role !== undefined ? (opts.ai_role ?? undefined) : 'archer',
    hp: opts?.hp !== undefined ? (opts.hp ?? undefined) : 15,
    guard: opts?.guard !== undefined ? (opts.guard ?? undefined) : 2,
    speed: opts?.speed !== undefined ? (opts.speed ?? undefined) : 5,
    move_range: opts?.move_range !== undefined ? (opts.move_range ?? undefined) : 3,
  });
  // Set facing via direct SQL since addEnemy doesn't expose the v3 column
  if (opts?.facing !== undefined) {
    db.prepare("UPDATE encounter_enemies SET facing = ? WHERE display_name = 'Goblin Archer'").run(opts.facing);
  } else {
    db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE display_name = 'Goblin Archer'").run();
  }
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('configureDefaultLayers', () => {
  it('creates all 5 combat UI layers', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    expect(layers).toHaveLength(5);
    const keys = layers.map(l => l.layer_key);
    expect(keys).toContain('intent');
    expect(keys).toContain('threat');
    expect(keys).toContain('forecast');
    expect(keys).toContain('terrain');
    expect(keys).toContain('planning_undo');
  });

  it('assigns unique z_order to each layer', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    const zOrders = layers.map(l => l.z_order);
    const unique = new Set(zOrders);
    expect(unique.size).toBe(5);
  });

  it('intent layer is always_on', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    const intent = layers.find(l => l.layer_key === 'intent');
    expect(intent!.activation).toBe('always_on');
  });

  it('threat layer is toggle', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    const threat = layers.find(l => l.layer_key === 'threat');
    expect(threat!.activation).toBe('toggle');
  });

  it('forecast layer is selection-activated', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    const forecast = layers.find(l => l.layer_key === 'forecast');
    expect(forecast!.activation).toBe('selection');
  });

  it('each layer has shows_json describing what it renders', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    for (const layer of layers) {
      const shows = JSON.parse(layer.shows_json);
      expect(typeof shows).toBe('object');
      expect(Object.keys(shows).length).toBeGreaterThan(0);
    }
  });

  it('intent and threat layers have required_data_fields', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    const intent = layers.find(l => l.layer_key === 'intent');
    const intentFields = JSON.parse(intent!.required_data_fields!);
    expect(intentFields).toContain('facing');
    expect(intentFields).toContain('ai_role');

    const threat = layers.find(l => l.layer_key === 'threat');
    const threatFields = JSON.parse(threat!.required_data_fields!);
    expect(threatFields).toContain('move_range');
    expect(threatFields).toContain('speed');
  });

  it('terrain and planning_undo have no required_data_fields', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    const layers = configureDefaultLayers(db, contract.id);

    const terrain = layers.find(l => l.layer_key === 'terrain');
    const terrainFields = JSON.parse(terrain!.required_data_fields!);
    expect(terrainFields).toHaveLength(0);

    const planning = layers.find(l => l.layer_key === 'planning_undo');
    const planningFields = JSON.parse(planning!.required_data_fields!);
    expect(planningFields).toHaveLength(0);
  });

  it('replaces existing layers when called again', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);
    configureDefaultLayers(db, contract.id);

    const allLayers = getLayersByContract(db, contract.id);
    expect(allLayers).toHaveLength(5); // not doubled
  });

  it('throws for nonexistent contract', () => {
    expect(() => configureDefaultLayers(db, 'nonexistent')).toThrow('Scene contract not found');
  });
});

describe('validateLayerDependencies', () => {
  it('passes when all enemies have required fields', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);

    const result = validateLayerDependencies(db, contract.id);
    expect(result.pass).toBe(true);
    expect(result.z_order_valid).toBe(true);
  });

  it('fails threat layer when enemies lack move_range', () => {
    seedEncounterWithEnemies({ move_range: null, speed: null });
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);

    const result = validateLayerDependencies(db, contract.id);
    const threat = result.layers.find(l => l.layer_key === 'threat');
    expect(threat!.pass).toBe(false);
    expect(threat!.missing_fields.length).toBeGreaterThan(0);
    expect(threat!.missing_fields.some(f => f.field === 'move_range')).toBe(true);
  });

  it('fails intent layer when enemies lack facing', () => {
    seedEncounterWithEnemies({ facing: null, ai_role: null });
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);

    const result = validateLayerDependencies(db, contract.id);
    const intent = result.layers.find(l => l.layer_key === 'intent');
    expect(intent!.pass).toBe(false);
    expect(intent!.missing_fields.some(f => f.field === 'facing')).toBe(true);
  });

  it('fails forecast layer when enemies lack hp', () => {
    seedEncounterWithEnemies({ hp: null, guard: null });
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);

    const result = validateLayerDependencies(db, contract.id);
    const forecast = result.layers.find(l => l.layer_key === 'forecast');
    expect(forecast!.pass).toBe(false);
  });

  it('terrain layer passes even with no data (graceful)', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);

    const result = validateLayerDependencies(db, contract.id);
    const terrain = result.layers.find(l => l.layer_key === 'terrain');
    expect(terrain!.pass).toBe(true);
  });

  it('planning_undo layer always passes', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);

    const result = validateLayerDependencies(db, contract.id);
    const planning = result.layers.find(l => l.layer_key === 'planning_undo');
    expect(planning!.pass).toBe(true);
  });

  it('detects z_order conflicts when layers share same z', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    clearLayersByContract(db, contract.id);

    // Manually insert two layers with same z_order
    configureLayer(db, contract.id, { layer_key: 'intent', z_order: 1 });
    configureLayer(db, contract.id, { layer_key: 'threat', z_order: 1 }); // conflict!

    const result = validateLayerDependencies(db, contract.id);
    expect(result.z_order_valid).toBe(false);
    expect(result.z_order_conflicts.length).toBeGreaterThan(0);
  });

  it('passes with empty encounter (no enemies)', () => {
    upsertProject(db, 'proj-ul', 'UI Layers Project', '/tmp/ul');
    upsertEncounter(db, {
      id: 'enc-empty',
      project_id: 'proj-ul',
      chapter: 'ch1',
      label: 'Empty',
      grid_rows: 3,
      grid_cols: 8,
    });
    const contract = createSceneContract(db, 'proj-ul', 'enc-empty');
    configureDefaultLayers(db, contract.id);

    const result = validateLayerDependencies(db, contract.id);
    // No enemies → no required fields to check → passes
    expect(result.pass).toBe(true);
  });
});

describe('getLayerStatus', () => {
  it('returns layers ordered by z_order', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');
    configureDefaultLayers(db, contract.id);

    const layers = getLayerStatus(db, contract.id);
    expect(layers).toHaveLength(5);
    for (let i = 1; i < layers.length; i++) {
      expect(layers[i].z_order).toBeGreaterThan(layers[i - 1].z_order);
    }
  });

  it('returns empty array for contract with no layers', () => {
    seedEncounterWithEnemies();
    const contract = createSceneContract(db, 'proj-ul', 'enc-ul');

    const layers = getLayerStatus(db, contract.id);
    expect(layers).toHaveLength(0);
  });
});
