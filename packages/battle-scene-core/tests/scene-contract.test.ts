import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract,
  validateSceneContract,
  transitionSceneContractState,
} from '@mcptoolshop/battle-scene-core';

let db: Database.Database;

function seedEncounter(id = 'enc-1', rows = 3, cols = 8) {
  upsertProject(db, 'proj-sc', 'Scene Contract Project', '/tmp/sc');
  upsertEncounter(db, {
    id,
    project_id: 'proj-sc',
    chapter: 'ch1',
    label: 'Test Encounter',
    grid_rows: rows,
    grid_cols: cols,
  });
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('createSceneContract', () => {
  it('creates contract from encounter with correct grid dimensions', () => {
    seedEncounter('enc-1', 4, 10);
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');

    expect(contract.id).toMatch(/^bsc_/);
    expect(contract.project_id).toBe('proj-sc');
    expect(contract.encounter_id).toBe('enc-1');
    expect(contract.board_rows).toBe(4);
    expect(contract.board_cols).toBe(10);
  });

  it('uses default tile size, viewport, and origin from battle_scene.gd shell', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');

    expect(contract.tile_size_px).toBe(64);
    expect(contract.board_origin_x).toBe(128);
    expect(contract.board_origin_y).toBe(96);
    expect(contract.viewport_width).toBe(1280);
    expect(contract.viewport_height).toBe(720);
    expect(contract.camera_zoom).toBe(1.0);
  });

  it('uses default sprite and readability settings', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');

    expect(contract.sprite_target_size).toBe(48);
    expect(contract.unit_tile_ratio_min).toBe(0.5);
    expect(contract.unit_tile_ratio_max).toBe(1.2);
    expect(contract.min_unit_contrast).toBe(40.0);
    expect(contract.max_hud_overlap_pct).toBe(0.15);
  });

  it('populates default HUD zones and overlay order', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');

    const hudZones = JSON.parse(contract.hud_zones_json!);
    expect(hudZones.length).toBe(3);
    expect(hudZones[0].name).toBe('turn_order');

    const overlayOrder = JSON.parse(contract.overlay_order_json!);
    expect(overlayOrder).toEqual(['intent', 'threat', 'forecast', 'terrain', 'planning_undo']);
  });

  it('accepts overrides for all contract fields', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1', {
      tile_size_px: 32,
      viewport_width: 1920,
      viewport_height: 1080,
      sprite_target_size: 24,
      min_unit_contrast: 60.0,
    });

    expect(contract.tile_size_px).toBe(32);
    expect(contract.viewport_width).toBe(1920);
    expect(contract.viewport_height).toBe(1080);
    expect(contract.sprite_target_size).toBe(24);
    expect(contract.min_unit_contrast).toBe(60.0);
  });

  it('generates scene_key from chapter and encounter id', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    expect(contract.scene_key).toBe('ch1_enc-1');
  });

  it('starts in draft production state', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    expect(contract.production_state).toBe('draft');
  });

  it('throws for nonexistent encounter', () => {
    upsertProject(db, 'proj-sc', 'Test', '/tmp');
    expect(() => createSceneContract(db, 'proj-sc', 'nonexistent')).toThrow('Encounter not found');
  });
});

describe('validateSceneContract', () => {
  it('passes for default 3x8 grid with default viewport', () => {
    seedEncounter('enc-1', 3, 8);
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    const result = validateSceneContract(db, contract.id);

    expect(result.pass).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it('fails when board exceeds viewport', () => {
    seedEncounter('enc-big', 20, 20);
    const contract = createSceneContract(db, 'proj-sc', 'enc-big');
    const result = validateSceneContract(db, contract.id);

    const boardCheck = result.checks.find(c => c.check === 'board_fits_viewport');
    expect(boardCheck).toBeDefined();
    expect(boardCheck!.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it('checks sprite-to-tile ratio', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    const result = validateSceneContract(db, contract.id);

    const ratioCheck = result.checks.find(c => c.check === 'sprite_tile_ratio');
    expect(ratioCheck).toBeDefined();
    // Default: 48/64 = 0.75, within [0.5, 1.2]
    expect(ratioCheck!.pass).toBe(true);
  });

  it('fails sprite ratio when sprite is too small for tile', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1', {
      sprite_target_size: 16, // 16/64 = 0.25, below 0.5 min
    });
    const result = validateSceneContract(db, contract.id);

    const ratioCheck = result.checks.find(c => c.check === 'sprite_tile_ratio');
    expect(ratioCheck!.pass).toBe(false);
  });

  it('validates overlay order completeness', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    const result = validateSceneContract(db, contract.id);

    const overlayCheck = result.checks.find(c => c.check === 'overlay_order_complete');
    expect(overlayCheck!.pass).toBe(true);
  });
});

describe('transitionSceneContractState', () => {
  it('transitions from draft to contract_defined', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    transitionSceneContractState(db, contract.id, 'contract_defined', 'Contract filled');

    const row = db.prepare('SELECT production_state FROM battle_scene_contracts WHERE id = ?').get(contract.id) as any;
    expect(row.production_state).toBe('contract_defined');
  });

  it('emits state event on transition', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    transitionSceneContractState(db, contract.id, 'contract_defined');

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'battle_scene' AND entity_id = ?"
    ).all(contract.id) as any[];
    expect(events.length).toBe(1);
    expect(events[0].from_state).toBe('draft');
    expect(events[0].to_state).toBe('contract_defined');
  });

  it('rejects illegal backward transitions', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');
    transitionSceneContractState(db, contract.id, 'contract_defined');
    expect(() => transitionSceneContractState(db, contract.id, 'draft'))
      .toThrow("Cannot transition");
  });

  it('supports full forward chain', () => {
    seedEncounter();
    const contract = createSceneContract(db, 'proj-sc', 'enc-1');

    const chain: Array<import('@mcptoolshop/game-foundry-registry').BattleSceneProductionState> = [
      'contract_defined', 'layers_configured', 'snapshots_captured', 'proof_passed', 'frozen',
    ];
    for (const state of chain) {
      transitionSceneContractState(db, contract.id, state);
    }

    const row = db.prepare('SELECT production_state FROM battle_scene_contracts WHERE id = ?').get(contract.id) as any;
    expect(row.production_state).toBe('frozen');
  });
});
