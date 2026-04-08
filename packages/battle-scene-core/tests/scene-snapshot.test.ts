import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract,
  configureDefaultLayers,
  captureSnapshot,
  captureAllSnapshots,
  listSnapshots,
} from '@mcptoolshop/battle-scene-core';
import type { SnapshotLayout } from '@mcptoolshop/battle-scene-core';

let db: Database.Database;

function seed() {
  upsertProject(db, 'proj-ss', 'Snapshot Project', '/tmp/ss');
  upsertEncounter(db, { id: 'enc-ss', project_id: 'proj-ss', chapter: 'ch1', label: 'Snap Test', grid_rows: 3, grid_cols: 8 });
  addEnemy(db, { encounter_id: 'enc-ss', display_name: 'Guard', variant_id: 'guard_base', sprite_pack: 'guards', grid_row: 1, grid_col: 3 });
  addEnemy(db, { encounter_id: 'enc-ss', display_name: 'Archer', variant_id: 'archer_base', sprite_pack: 'guards', grid_row: 0, grid_col: 6 });
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('captureSnapshot', () => {
  it('captures neutral state with correct layout', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    configureDefaultLayers(db, contract.id);
    const snap = captureSnapshot(db, contract.id, 'neutral');

    expect(snap.snapshot_key).toBe('neutral');
    const layout: SnapshotLayout = JSON.parse(snap.layout_json);
    expect(layout.units).toHaveLength(2);
    expect(layout.active_layers).toContain('planning_undo');
    expect(layout.active_layers).not.toContain('threat');
  });

  it('captures threat_on state with threat and intent layers active', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    configureDefaultLayers(db, contract.id);
    const snap = captureSnapshot(db, contract.id, 'threat_on');

    const stateDesc = JSON.parse(snap.state_desc_json);
    expect(stateDesc.layers_active).toContain('intent');
    expect(stateDesc.layers_active).toContain('threat');
  });

  it('computes unit positions in pixel space from grid', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    const snap = captureSnapshot(db, contract.id, 'neutral');
    const layout: SnapshotLayout = JSON.parse(snap.layout_json);

    const guard = layout.units.find(u => u.display_name === 'Guard');
    // grid (1, 3), origin (128, 96), tile 64px
    expect(guard!.pixel_x).toBe(128 + 3 * 64); // 320
    expect(guard!.pixel_y).toBe(96 + 1 * 64);  // 160
    expect(guard!.pixel_center_x).toBe(320 + 32); // 352
    expect(guard!.pixel_center_y).toBe(160 + 32); // 192
  });

  it('includes board_rect in layout', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    const snap = captureSnapshot(db, contract.id, 'neutral');
    const layout: SnapshotLayout = JSON.parse(snap.layout_json);

    expect(layout.board_rect).toEqual({ x: 128, y: 96, w: 512, h: 192 });
  });

  it('includes HUD zones in layout', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    const snap = captureSnapshot(db, contract.id, 'neutral');
    const layout: SnapshotLayout = JSON.parse(snap.layout_json);

    expect(layout.hud_zones.length).toBeGreaterThan(0);
    expect(layout.hud_zones[0]).toHaveProperty('name');
  });
});

describe('captureAllSnapshots', () => {
  it('captures all 5 canonical states', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    configureDefaultLayers(db, contract.id);
    const snaps = captureAllSnapshots(db, contract.id);

    expect(snaps).toHaveLength(5);
    const keys = snaps.map(s => s.snapshot_key);
    expect(keys).toContain('neutral');
    expect(keys).toContain('threat_on');
    expect(keys).toContain('forecast');
    expect(keys).toContain('enemy_turn');
    expect(keys).toContain('pre_commit');
  });

  it('each snapshot has different active layers', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    configureDefaultLayers(db, contract.id);
    const snaps = captureAllSnapshots(db, contract.id);

    const neutralLayers = JSON.parse(snaps.find(s => s.snapshot_key === 'neutral')!.state_desc_json).layers_active;
    const threatLayers = JSON.parse(snaps.find(s => s.snapshot_key === 'threat_on')!.state_desc_json).layers_active;
    expect(neutralLayers.length).toBeLessThan(threatLayers.length);
  });
});

describe('listSnapshots', () => {
  it('returns all captured snapshots', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    captureAllSnapshots(db, contract.id);

    const listed = listSnapshots(db, contract.id);
    expect(listed).toHaveLength(5);
  });

  it('returns empty for contract with no snapshots', () => {
    seed();
    const contract = createSceneContract(db, 'proj-ss', 'enc-ss');
    expect(listSnapshots(db, contract.id)).toHaveLength(0);
  });
});
