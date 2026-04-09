import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertRenderDoctrine,
  getRenderDoctrine,
  getRenderDoctrineOrDefaults,
  DOCTRINE_DEFAULTS,
} from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-rd', 'Render Doctrine Project', '/tmp/rd');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('upsertRenderDoctrine', () => {
  it('creates doctrine with all defaults', () => {
    seedProject();
    const row = upsertRenderDoctrine(db, { project_id: 'proj-rd' });

    expect(row.project_id).toBe('proj-rd');
    expect(row.engine_baseline).toBe('blender-4.2');
    expect(row.camera_projection).toBe('orthographic');
    expect(row.camera_yaw).toBe(45.0);
    expect(row.camera_pitch).toBeCloseTo(35.264);
    expect(row.occupancy_min).toBe(0.18);
    expect(row.occupancy_max).toBe(0.55);
    expect(row.perimeter_complexity_max).toBe(1.25);
    expect(row.pose_delta_min).toBe(0.12);
    expect(row.class_confusion_max_iou).toBe(0.65);
    expect(row.min_board_contrast).toBe(40.0);
    expect(row.alpha_policy).toBe('straight');
    expect(row.shader_family).toBe('pbr_simplified');
  });

  it('creates doctrine with custom thresholds', () => {
    seedProject();
    const row = upsertRenderDoctrine(db, {
      project_id: 'proj-rd',
      occupancy_min: 0.25,
      perimeter_complexity_max: 1.50,
      shader_family: 'toon_ramp',
    });

    expect(row.occupancy_min).toBe(0.25);
    expect(row.perimeter_complexity_max).toBe(1.50);
    expect(row.shader_family).toBe('toon_ramp');
  });

  it('upserts preserving unset fields via COALESCE', () => {
    seedProject();
    upsertRenderDoctrine(db, { project_id: 'proj-rd', occupancy_min: 0.20 });
    const updated = upsertRenderDoctrine(db, { project_id: 'proj-rd', occupancy_max: 0.60 });

    expect(updated.occupancy_min).toBe(0.20); // preserved
    expect(updated.occupancy_max).toBe(0.60); // updated
  });

  it('stores and retrieves JSON columns correctly', () => {
    seedProject();
    const custom = '{"standard":2,"boss":3}';
    const row = upsertRenderDoctrine(db, {
      project_id: 'proj-rd',
      outline_thickness_json: custom,
    });

    expect(row.outline_thickness_json).toBe(custom);
    const parsed = JSON.parse(row.outline_thickness_json);
    expect(parsed.standard).toBe(2);
    expect(parsed.boss).toBe(3);
  });
});

describe('getRenderDoctrine', () => {
  it('returns stored row', () => {
    seedProject();
    upsertRenderDoctrine(db, { project_id: 'proj-rd', camera_projection: 'perspective' });

    const row = getRenderDoctrine(db, 'proj-rd');
    expect(row).toBeDefined();
    expect(row!.camera_projection).toBe('perspective');
  });

  it('returns undefined for missing project', () => {
    expect(getRenderDoctrine(db, 'nonexistent')).toBeUndefined();
  });
});

describe('getRenderDoctrineOrDefaults', () => {
  it('returns synthetic defaults when no row exists', () => {
    seedProject();
    const row = getRenderDoctrineOrDefaults(db, 'proj-rd');

    expect(row.project_id).toBe('proj-rd');
    expect(row.occupancy_min).toBe(DOCTRINE_DEFAULTS.occupancy_min);
    expect(row.camera_pitch).toBe(DOCTRINE_DEFAULTS.camera_pitch);
    expect(row.alpha_policy).toBe('straight');
  });

  it('returns stored row when it exists', () => {
    seedProject();
    upsertRenderDoctrine(db, { project_id: 'proj-rd', occupancy_min: 0.30 });

    const row = getRenderDoctrineOrDefaults(db, 'proj-rd');
    expect(row.occupancy_min).toBe(0.30);
  });

  it('DOCTRINE_DEFAULTS matches expected values from render doctrine document', () => {
    expect(DOCTRINE_DEFAULTS.camera_yaw).toBe(45.0);
    expect(DOCTRINE_DEFAULTS.camera_focal_length).toBe(85.0);
    expect(DOCTRINE_DEFAULTS.direction_count).toBe(8);
    expect(DOCTRINE_DEFAULTS.key_fill_ratio).toBe(3.0);
    expect(DOCTRINE_DEFAULTS.rim_intensity).toBe(0.85);
    expect(DOCTRINE_DEFAULTS.recognition_class_pct).toBe(90.0);
    expect(DOCTRINE_DEFAULTS.recognition_action_pct).toBe(80.0);
  });
});
