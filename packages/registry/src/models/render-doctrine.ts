import type Database from 'better-sqlite3';
import type { RenderDoctrineRow } from '../types.js';

/** System defaults matching the DDL column defaults — single source of truth */
export const DOCTRINE_DEFAULTS: RenderDoctrineRow = {
  project_id: '',
  engine_baseline: 'blender-4.2',
  final_renderer: 'cycles',
  iteration_renderer: 'eevee',
  camera_projection: 'orthographic',
  camera_yaw: 45.0,
  camera_pitch: 35.264,
  camera_focal_length: 85.0,
  orbit_rig: 'turntable',
  direction_count: 8,
  direction_labels_json: '["N","NE","E","SE","S","SW","W","NW"]',
  yaw_step: 45.0,
  cell_sizes_json: '{"small":64,"standard":128,"large":256}',
  target_heights_json: '{"small":48,"standard":96,"large":192}',
  oversample_factor: 2,
  lighting_rig: 'combat_3point',
  key_fill_ratio: 3.0,
  rim_intensity: 0.85,
  shader_family: 'pbr_simplified',
  outline_method: 'freestyle',
  outline_thickness_json: '{"standard":1,"boss":2}',
  edge_doctrine: 'high_quality_aa',
  alpha_policy: 'straight',
  color_space: 'sRGB',
  view_transform: 'AgX',
  export_formats_json: '["png"]',
  naming_convention: '{unit}_{variant}_{action}_{dir}_{frame:04d}_{pass}.png',
  occupancy_min: 0.18,
  occupancy_max: 0.55,
  occupancy_min_large: 0.28,
  occupancy_max_large: 0.55,
  perimeter_complexity_max: 1.25,
  pose_delta_min: 0.12,
  class_confusion_max_iou: 0.65,
  recognition_class_pct: 90.0,
  recognition_action_pct: 80.0,
  board_test_backgrounds_json: '["dark","mid","noisy"]',
  min_board_contrast: 40.0,
  required_passes_json: '["beauty","outline","mask","normal"]',
  created_at: '',
  updated_at: '',
};

export interface UpsertRenderDoctrineInput {
  project_id: string;
  engine_baseline?: string;
  final_renderer?: string;
  iteration_renderer?: string;
  camera_projection?: string;
  camera_yaw?: number;
  camera_pitch?: number;
  camera_focal_length?: number;
  orbit_rig?: string;
  direction_count?: number;
  direction_labels_json?: string;
  yaw_step?: number;
  cell_sizes_json?: string;
  target_heights_json?: string;
  oversample_factor?: number;
  lighting_rig?: string;
  key_fill_ratio?: number;
  rim_intensity?: number;
  shader_family?: string;
  outline_method?: string;
  outline_thickness_json?: string;
  edge_doctrine?: string;
  alpha_policy?: string;
  color_space?: string;
  view_transform?: string;
  export_formats_json?: string;
  naming_convention?: string;
  occupancy_min?: number;
  occupancy_max?: number;
  occupancy_min_large?: number;
  occupancy_max_large?: number;
  perimeter_complexity_max?: number;
  pose_delta_min?: number;
  class_confusion_max_iou?: number;
  recognition_class_pct?: number;
  recognition_action_pct?: number;
  board_test_backgrounds_json?: string;
  min_board_contrast?: number;
  required_passes_json?: string;
}

export function upsertRenderDoctrine(
  db: Database.Database,
  input: UpsertRenderDoctrineInput,
): RenderDoctrineRow {
  const d = DOCTRINE_DEFAULTS;
  const existing = db.prepare('SELECT 1 FROM render_doctrines WHERE project_id = ?').get(input.project_id);

  if (!existing) {
    // First insert: use defaults for unspecified fields
    db.prepare(`
      INSERT INTO render_doctrines (
        project_id, engine_baseline, final_renderer, iteration_renderer,
        camera_projection, camera_yaw, camera_pitch, camera_focal_length, orbit_rig,
        direction_count, direction_labels_json, yaw_step,
        cell_sizes_json, target_heights_json, oversample_factor,
        lighting_rig, key_fill_ratio, rim_intensity, shader_family,
        outline_method, outline_thickness_json, edge_doctrine,
        alpha_policy, color_space, view_transform, export_formats_json, naming_convention,
        occupancy_min, occupancy_max, occupancy_min_large, occupancy_max_large,
        perimeter_complexity_max, pose_delta_min, class_confusion_max_iou,
        recognition_class_pct, recognition_action_pct,
        board_test_backgrounds_json, min_board_contrast, required_passes_json
      ) VALUES (
        @project_id, @engine_baseline, @final_renderer, @iteration_renderer,
        @camera_projection, @camera_yaw, @camera_pitch, @camera_focal_length, @orbit_rig,
        @direction_count, @direction_labels_json, @yaw_step,
        @cell_sizes_json, @target_heights_json, @oversample_factor,
        @lighting_rig, @key_fill_ratio, @rim_intensity, @shader_family,
        @outline_method, @outline_thickness_json, @edge_doctrine,
        @alpha_policy, @color_space, @view_transform, @export_formats_json, @naming_convention,
        @occupancy_min, @occupancy_max, @occupancy_min_large, @occupancy_max_large,
        @perimeter_complexity_max, @pose_delta_min, @class_confusion_max_iou,
        @recognition_class_pct, @recognition_action_pct,
        @board_test_backgrounds_json, @min_board_contrast, @required_passes_json
      )
    `).run({
      project_id: input.project_id,
      engine_baseline: input.engine_baseline ?? d.engine_baseline,
      final_renderer: input.final_renderer ?? d.final_renderer,
      iteration_renderer: input.iteration_renderer ?? d.iteration_renderer,
      camera_projection: input.camera_projection ?? d.camera_projection,
      camera_yaw: input.camera_yaw ?? d.camera_yaw,
      camera_pitch: input.camera_pitch ?? d.camera_pitch,
      camera_focal_length: input.camera_focal_length ?? d.camera_focal_length,
      orbit_rig: input.orbit_rig ?? d.orbit_rig,
      direction_count: input.direction_count ?? d.direction_count,
      direction_labels_json: input.direction_labels_json ?? d.direction_labels_json,
      yaw_step: input.yaw_step ?? d.yaw_step,
      cell_sizes_json: input.cell_sizes_json ?? d.cell_sizes_json,
      target_heights_json: input.target_heights_json ?? d.target_heights_json,
      oversample_factor: input.oversample_factor ?? d.oversample_factor,
      lighting_rig: input.lighting_rig ?? d.lighting_rig,
      key_fill_ratio: input.key_fill_ratio ?? d.key_fill_ratio,
      rim_intensity: input.rim_intensity ?? d.rim_intensity,
      shader_family: input.shader_family ?? d.shader_family,
      outline_method: input.outline_method ?? d.outline_method,
      outline_thickness_json: input.outline_thickness_json ?? d.outline_thickness_json,
      edge_doctrine: input.edge_doctrine ?? d.edge_doctrine,
      alpha_policy: input.alpha_policy ?? d.alpha_policy,
      color_space: input.color_space ?? d.color_space,
      view_transform: input.view_transform ?? d.view_transform,
      export_formats_json: input.export_formats_json ?? d.export_formats_json,
      naming_convention: input.naming_convention ?? d.naming_convention,
      occupancy_min: input.occupancy_min ?? d.occupancy_min,
      occupancy_max: input.occupancy_max ?? d.occupancy_max,
      occupancy_min_large: input.occupancy_min_large ?? d.occupancy_min_large,
      occupancy_max_large: input.occupancy_max_large ?? d.occupancy_max_large,
      perimeter_complexity_max: input.perimeter_complexity_max ?? d.perimeter_complexity_max,
      pose_delta_min: input.pose_delta_min ?? d.pose_delta_min,
      class_confusion_max_iou: input.class_confusion_max_iou ?? d.class_confusion_max_iou,
      recognition_class_pct: input.recognition_class_pct ?? d.recognition_class_pct,
      recognition_action_pct: input.recognition_action_pct ?? d.recognition_action_pct,
      board_test_backgrounds_json: input.board_test_backgrounds_json ?? d.board_test_backgrounds_json,
      min_board_contrast: input.min_board_contrast ?? d.min_board_contrast,
      required_passes_json: input.required_passes_json ?? d.required_passes_json,
    });
  } else {
    // Update: only set fields that were explicitly provided
    const fieldMap: Record<string, unknown> = {
      engine_baseline: input.engine_baseline,
      final_renderer: input.final_renderer,
      iteration_renderer: input.iteration_renderer,
      camera_projection: input.camera_projection,
      camera_yaw: input.camera_yaw,
      camera_pitch: input.camera_pitch,
      camera_focal_length: input.camera_focal_length,
      orbit_rig: input.orbit_rig,
      direction_count: input.direction_count,
      direction_labels_json: input.direction_labels_json,
      yaw_step: input.yaw_step,
      cell_sizes_json: input.cell_sizes_json,
      target_heights_json: input.target_heights_json,
      oversample_factor: input.oversample_factor,
      lighting_rig: input.lighting_rig,
      key_fill_ratio: input.key_fill_ratio,
      rim_intensity: input.rim_intensity,
      shader_family: input.shader_family,
      outline_method: input.outline_method,
      outline_thickness_json: input.outline_thickness_json,
      edge_doctrine: input.edge_doctrine,
      alpha_policy: input.alpha_policy,
      color_space: input.color_space,
      view_transform: input.view_transform,
      export_formats_json: input.export_formats_json,
      naming_convention: input.naming_convention,
      occupancy_min: input.occupancy_min,
      occupancy_max: input.occupancy_max,
      occupancy_min_large: input.occupancy_min_large,
      occupancy_max_large: input.occupancy_max_large,
      perimeter_complexity_max: input.perimeter_complexity_max,
      pose_delta_min: input.pose_delta_min,
      class_confusion_max_iou: input.class_confusion_max_iou,
      recognition_class_pct: input.recognition_class_pct,
      recognition_action_pct: input.recognition_action_pct,
      board_test_backgrounds_json: input.board_test_backgrounds_json,
      min_board_contrast: input.min_board_contrast,
      required_passes_json: input.required_passes_json,
    };
    const setClauses: string[] = [];
    const values: unknown[] = [];
    for (const [col, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        setClauses.push(`${col} = ?`);
        values.push(val);
      }
    }
    if (setClauses.length > 0) {
      setClauses.push("updated_at = datetime('now')");
      values.push(input.project_id);
      db.prepare(`UPDATE render_doctrines SET ${setClauses.join(', ')} WHERE project_id = ?`).run(...values);
    }
  }

  return db.prepare('SELECT * FROM render_doctrines WHERE project_id = ?')
    .get(input.project_id) as RenderDoctrineRow;
}

export function getRenderDoctrine(
  db: Database.Database,
  projectId: string,
): RenderDoctrineRow | undefined {
  return db.prepare('SELECT * FROM render_doctrines WHERE project_id = ?')
    .get(projectId) as RenderDoctrineRow | undefined;
}

export function getRenderDoctrineOrDefaults(
  db: Database.Database,
  projectId: string,
): RenderDoctrineRow {
  const row = getRenderDoctrine(db, projectId);
  if (row) return row;

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return { ...DOCTRINE_DEFAULTS, project_id: projectId, created_at: now, updated_at: now };
}
