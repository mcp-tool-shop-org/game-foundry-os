import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, SCHEMA_VERSION } from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('schema v9 — battle scene tables', () => {
  it('schema version is at least 9', () => {
    expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(9);
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as any;
    expect(row.v).toBeGreaterThanOrEqual(9);
  });

  it('battle_scene_contracts table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('battle_scene_contracts')").all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('project_id');
    expect(names).toContain('encounter_id');
    expect(names).toContain('scene_key');
    expect(names).toContain('board_rows');
    expect(names).toContain('board_cols');
    expect(names).toContain('tile_size_px');
    expect(names).toContain('board_origin_x');
    expect(names).toContain('board_origin_y');
    expect(names).toContain('viewport_width');
    expect(names).toContain('viewport_height');
    expect(names).toContain('camera_zoom');
    expect(names).toContain('sprite_target_size');
    expect(names).toContain('unit_tile_ratio_min');
    expect(names).toContain('unit_tile_ratio_max');
    expect(names).toContain('hud_zones_json');
    expect(names).toContain('overlay_order_json');
    expect(names).toContain('min_unit_contrast');
    expect(names).toContain('max_hud_overlap_pct');
    expect(names).toContain('production_state');
  });

  it('combat_ui_layers table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('combat_ui_layers')").all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('contract_id');
    expect(names).toContain('layer_key');
    expect(names).toContain('display_name');
    expect(names).toContain('z_order');
    expect(names).toContain('activation');
    expect(names).toContain('shows_json');
    expect(names).toContain('required_data_fields');
    expect(names).toContain('legibility_min_size');
  });

  it('battle_scene_snapshots table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('battle_scene_snapshots')").all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('contract_id');
    expect(names).toContain('snapshot_key');
    expect(names).toContain('state_desc_json');
    expect(names).toContain('layout_json');
    expect(names).toContain('screenshot_path');
    expect(names).toContain('proof_run_id');
  });

  it('playtest_sessions table exists with all columns', () => {
    const cols = db.prepare("PRAGMA table_info('playtest_sessions')").all() as any[];
    const names = cols.map((c: any) => c.name);
    expect(names).toContain('id');
    expect(names).toContain('project_id');
    expect(names).toContain('encounter_id');
    expect(names).toContain('contract_id');
    expect(names).toContain('session_state');
    expect(names).toContain('read_failures');
    expect(names).toContain('failures_json');
    expect(names).toContain('quality_verdict');
  });

  it('battle_scene_contracts CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare("INSERT INTO encounters (id, project_id, chapter, label) VALUES ('e1', 'p1', 'ch1', 'Test Enc')").run();

    db.prepare(`
      INSERT INTO battle_scene_contracts (id, project_id, encounter_id, scene_key, board_rows, board_cols)
      VALUES ('bsc1', 'p1', 'e1', 'ch1_e1', 3, 8)
    `).run();

    const row = db.prepare('SELECT * FROM battle_scene_contracts WHERE id = ?').get('bsc1') as any;
    expect(row.project_id).toBe('p1');
    expect(row.encounter_id).toBe('e1');
    expect(row.board_rows).toBe(3);
    expect(row.board_cols).toBe(8);
    expect(row.tile_size_px).toBe(64);
    expect(row.production_state).toBe('draft');
  });

  it('combat_ui_layers CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare("INSERT INTO encounters (id, project_id, chapter, label) VALUES ('e1', 'p1', 'ch1', 'Test')").run();
    db.prepare("INSERT INTO battle_scene_contracts (id, project_id, encounter_id, scene_key, board_rows, board_cols) VALUES ('bsc1', 'p1', 'e1', 'test', 3, 8)").run();

    db.prepare(`
      INSERT INTO combat_ui_layers (id, contract_id, layer_key, display_name, z_order, activation, shows_json)
      VALUES ('l1', 'bsc1', 'intent', 'Enemy Intent', 1, 'always_on', '{"targeted_tiles":true}')
    `).run();

    const row = db.prepare('SELECT * FROM combat_ui_layers WHERE id = ?').get('l1') as any;
    expect(row.layer_key).toBe('intent');
    expect(row.z_order).toBe(1);
    expect(JSON.parse(row.shows_json).targeted_tiles).toBe(true);
  });

  it('playtest_sessions CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare("INSERT INTO encounters (id, project_id, chapter, label) VALUES ('e1', 'p1', 'ch1', 'Test')").run();

    db.prepare(`
      INSERT INTO playtest_sessions (id, project_id, encounter_id, session_state)
      VALUES ('ps1', 'p1', 'e1', 'started')
    `).run();

    const row = db.prepare('SELECT * FROM playtest_sessions WHERE id = ?').get('ps1') as any;
    expect(row.session_state).toBe('started');
    expect(row.read_failures).toBe(0);
    expect(row.quality_verdict).toBeNull();
  });

  it('battle_scene_snapshots CRUD works', () => {
    db.prepare("INSERT INTO projects (id, display_name, root_path) VALUES ('p1', 'Test', '/tmp')").run();
    db.prepare("INSERT INTO encounters (id, project_id, chapter, label) VALUES ('e1', 'p1', 'ch1', 'Test')").run();
    db.prepare("INSERT INTO battle_scene_contracts (id, project_id, encounter_id, scene_key, board_rows, board_cols) VALUES ('bsc1', 'p1', 'e1', 'test', 3, 8)").run();

    db.prepare(`
      INSERT INTO battle_scene_snapshots (id, contract_id, snapshot_key, state_desc_json, layout_json)
      VALUES ('ss1', 'bsc1', 'neutral', '{"layers_active":[]}', '{"units":[]}')
    `).run();

    const row = db.prepare('SELECT * FROM battle_scene_snapshots WHERE id = ?').get('ss1') as any;
    expect(row.snapshot_key).toBe('neutral');
    expect(JSON.parse(row.layout_json).units).toEqual([]);
  });
});
