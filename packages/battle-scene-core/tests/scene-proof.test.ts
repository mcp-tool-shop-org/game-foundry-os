import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy, insertSnapshot } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract,
  configureDefaultLayers,
  runSceneProof,
} from '@mcptoolshop/battle-scene-core';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';

let db: Database.Database;

function seedFullEncounter() {
  upsertProject(db, 'proj-sp', 'Scene Proof Project', '/tmp/sp');
  upsertEncounter(db, {
    id: 'enc-sp',
    project_id: 'proj-sp',
    chapter: 'ch1',
    label: 'Proof Test',
    grid_rows: 3,
    grid_cols: 8,
  });
  addEnemy(db, {
    encounter_id: 'enc-sp',
    display_name: 'Skeleton Guard',
    variant_id: 'skeleton_guard_base',
    sprite_pack: 'skeleton_enemies',
    grid_row: 1,
    grid_col: 3,
    ai_role: 'tank',
    hp: 20,
    guard: 5,
    speed: 3,
    move_range: 2,
  });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE display_name = 'Skeleton Guard'").run();
  addEnemy(db, {
    encounter_id: 'enc-sp',
    display_name: 'Skeleton Archer',
    variant_id: 'skeleton_archer_base',
    sprite_pack: 'skeleton_enemies',
    grid_row: 0,
    grid_col: 6,
    ai_role: 'archer',
    hp: 12,
    guard: 1,
    speed: 4,
    move_range: 3,
  });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE display_name = 'Skeleton Archer'").run();
}

function goodSpriteMetrics(): SpriteMetrics[] {
  return [
    { variant_id: 'skeleton_guard_base', width: 48, height: 48, avg_luminance: 80 },
    { variant_id: 'skeleton_archer_base', width: 48, height: 48, avg_luminance: 75 },
  ];
}

function addAllSnapshots(contractId: string) {
  const keys = ['neutral', 'threat_on', 'forecast', 'enemy_turn', 'pre_commit'] as const;
  for (const key of keys) {
    insertSnapshot(db, {
      id: `ss_${key}`,
      contract_id: contractId,
      snapshot_key: key,
      state_desc_json: JSON.stringify({ layers_active: [] }),
      layout_json: JSON.stringify({ units: [] }),
    });
  }
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('runSceneProof — individual assertions', () => {
  it('board_fits_viewport passes for default 3x8 grid', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'board_fits_viewport');
    expect(a!.status).toBe('pass');
  });

  it('board_fits_viewport fails for oversized grid', () => {
    upsertProject(db, 'proj-sp', 'Test', '/tmp/sp');
    upsertEncounter(db, { id: 'enc-big', project_id: 'proj-sp', chapter: 'ch1', label: 'Big', grid_rows: 20, grid_cols: 20 });
    const contract = createSceneContract(db, 'proj-sp', 'enc-big');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'board_fits_viewport');
    expect(a!.status).toBe('fail');
  });

  it('tile_size_consistent passes for 64px', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'tile_size_consistent');
    expect(a!.status).toBe('pass');
  });

  it('tile_size_consistent warns for non-64px', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp', { tile_size_px: 32 });
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'tile_size_consistent');
    expect(a!.status).toBe('warn');
  });

  it('sprite_to_tile_ratio passes for 48px sprites on 64px tiles', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id, goodSpriteMetrics());

    const a = result.assertions.find(a => a.key === 'sprite_to_tile_ratio');
    expect(a!.status).toBe('pass');
  });

  it('sprite_to_tile_ratio fails for oversized sprites', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const bigSprites: SpriteMetrics[] = [
      { variant_id: 'skeleton_guard_base', width: 128, height: 128, avg_luminance: 80 },
    ];
    const result = runSceneProof(db, contract.id, bigSprites);

    const a = result.assertions.find(a => a.key === 'sprite_to_tile_ratio');
    expect(a!.status).toBe('fail');
  });

  it('sprite_to_tile_ratio warns when no metrics provided', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'sprite_to_tile_ratio');
    expect(a!.status).toBe('warn');
  });

  it('unit_occupancy_on_board passes for in-bounds units', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'unit_occupancy_on_board');
    expect(a!.status).toBe('pass');
  });

  it('contrast_vs_background passes for bright sprites', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id, goodSpriteMetrics());

    const a = result.assertions.find(a => a.key === 'contrast_vs_background');
    expect(a!.status).toBe('pass');
  });

  it('contrast_vs_background fails for dark sprites', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const darkSprites: SpriteMetrics[] = [
      { variant_id: 'skeleton_guard_base', width: 48, height: 48, avg_luminance: 10 },
    ];
    const result = runSceneProof(db, contract.id, darkSprites);

    const a = result.assertions.find(a => a.key === 'contrast_vs_background');
    expect(a!.status).toBe('fail');
  });

  it('hud_overlap_pressure passes for default setup', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'hud_overlap_pressure');
    expect(a!.status).toBe('pass');
  });

  it('hud_no_unit_occlusion passes when units not under HUD', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'hud_no_unit_occlusion');
    expect(a!.status).toBe('pass');
  });

  it('overlay_z_order_valid passes for default layers', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'overlay_z_order_valid');
    expect(a!.status).toBe('pass');
  });

  it('intent/threat/forecast layer data complete for full roster', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    expect(result.assertions.find(a => a.key === 'intent_layer_data_complete')!.status).toBe('pass');
    expect(result.assertions.find(a => a.key === 'threat_layer_data_complete')!.status).toBe('pass');
    expect(result.assertions.find(a => a.key === 'forecast_layer_data_complete')!.status).toBe('pass');
  });

  it('layer_legibility_space passes when indicators fit tiles', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'layer_legibility_space');
    expect(a!.status).toBe('pass');
  });

  it('snapshot_completeness warns when snapshots missing', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'snapshot_completeness');
    expect(a!.status).toBe('warn');
  });

  it('snapshot_completeness passes when all 5 snapshots present', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    addAllSnapshots(contract.id);
    const result = runSceneProof(db, contract.id);

    const a = result.assertions.find(a => a.key === 'snapshot_completeness');
    expect(a!.status).toBe('pass');
  });
});

describe('runSceneProof — overall result', () => {
  it('returns pass when all assertions pass', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    addAllSnapshots(contract.id);
    const result = runSceneProof(db, contract.id, goodSpriteMetrics());

    expect(result.result).toBe('pass');
    expect(result.blocking_failures).toBe(0);
  });

  it('returns partial when only warnings exist', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    // No snapshots → warning, no sprite metrics → warnings
    const result = runSceneProof(db, contract.id);

    expect(result.result).toBe('partial');
    expect(result.blocking_failures).toBe(0);
    expect(result.warning_count).toBeGreaterThan(0);
  });

  it('returns fail when any assertion fails', () => {
    upsertProject(db, 'proj-sp', 'Test', '/tmp/sp');
    upsertEncounter(db, { id: 'enc-fail', project_id: 'proj-sp', chapter: 'ch1', label: 'Fail', grid_rows: 20, grid_cols: 20 });
    const contract = createSceneContract(db, 'proj-sp', 'enc-fail');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    expect(result.result).toBe('fail');
    expect(result.blocking_failures).toBeGreaterThan(0);
  });

  it('persists proof run to DB', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const row = db.prepare('SELECT * FROM proof_runs WHERE id = ?').get(result.proof_run_id) as any;
    expect(row).toBeDefined();
    expect(row.scope_type).toBe('battle_scene');
    expect(row.tool_name).toBe('battle_run_scene_proof');
  });

  it('persists assertions to DB', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    const rows = db.prepare('SELECT * FROM proof_assertions WHERE proof_run_id = ?').all(result.proof_run_id) as any[];
    expect(rows.length).toBe(13);
  });

  it('produces 13 assertions', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    expect(result.assertions).toHaveLength(13);
  });

  it('generates receipt_hash', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    expect(result.receipt_hash).toBeTruthy();
    expect(result.receipt_hash.length).toBe(16);
  });
});

describe('runSceneProof — edge cases', () => {
  it('handles empty encounter (no enemies)', () => {
    upsertProject(db, 'proj-sp', 'Test', '/tmp/sp');
    upsertEncounter(db, { id: 'enc-empty', project_id: 'proj-sp', chapter: 'ch1', label: 'Empty', grid_rows: 3, grid_cols: 8 });
    const contract = createSceneContract(db, 'proj-sp', 'enc-empty');
    configureDefaultLayers(db, contract.id);
    const result = runSceneProof(db, contract.id);

    // Should not crash, unit checks should pass (vacuously true)
    expect(result.assertions.find(a => a.key === 'unit_occupancy_on_board')!.status).toBe('pass');
  });

  it('handles contract with no layers configured', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    // No configureDefaultLayers call
    const result = runSceneProof(db, contract.id);

    // Layer assertions should fail (layers not configured)
    expect(result.assertions.find(a => a.key === 'intent_layer_data_complete')!.status).toBe('fail');
    expect(result.assertions.find(a => a.key === 'overlay_z_order_valid')!.status).toBe('pass'); // 0 layers = no conflicts
  });

  it('all sprites below contrast threshold results in fail', () => {
    seedFullEncounter();
    const contract = createSceneContract(db, 'proj-sp', 'enc-sp');
    configureDefaultLayers(db, contract.id);
    const darkSprites: SpriteMetrics[] = [
      { variant_id: 'skeleton_guard_base', width: 48, height: 48, avg_luminance: 5 },
      { variant_id: 'skeleton_archer_base', width: 48, height: 48, avg_luminance: 8 },
    ];
    const result = runSceneProof(db, contract.id, darkSprites);

    expect(result.result).toBe('fail');
    const contrast = result.assertions.find(a => a.key === 'contrast_vs_background');
    expect(contrast!.status).toBe('fail');
    expect(contrast!.details!.issues).toHaveLength(2);
  });
});
