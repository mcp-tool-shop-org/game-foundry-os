import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { upsertRenderDoctrine } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerRenderDoctrineSet(server: McpServer): void {
  server.tool(
    'render_doctrine_set',
    'Set or update the render doctrine for a project — encodes Blender render standards, acceptance thresholds, and visual quality gates',
    {
      project_id: z.string().describe('Project ID'),
      engine_baseline: z.string().optional().describe('Blender version baseline (e.g. blender-4.2)'),
      final_renderer: z.string().optional().describe('Final render engine (cycles or eevee)'),
      iteration_renderer: z.string().optional().describe('Iteration render engine'),
      camera_projection: z.enum(['orthographic', 'perspective']).optional().describe('Camera projection type'),
      camera_yaw: z.number().optional().describe('Camera yaw angle in degrees'),
      camera_pitch: z.number().optional().describe('Camera pitch angle in degrees'),
      camera_focal_length: z.number().optional().describe('Focal length in mm (perspective only)'),
      orbit_rig: z.string().optional().describe('Orbit rig type'),
      direction_count: z.number().int().optional().describe('Number of sprite directions'),
      yaw_step: z.number().optional().describe('Yaw step between directions in degrees'),
      oversample_factor: z.number().int().optional().describe('Oversampling factor (2x or 4x)'),
      shader_family: z.enum(['pbr_simplified', 'toon_ramp', 'hybrid']).optional().describe('Shader family'),
      outline_method: z.enum(['freestyle', 'inverted_hull', 'compositor']).optional().describe('Outline method'),
      edge_doctrine: z.enum(['high_quality_aa', 'crisp_pixel']).optional().describe('Edge treatment doctrine'),
      alpha_policy: z.enum(['straight', 'premultiplied']).optional().describe('Alpha export policy'),
      color_space: z.string().optional().describe('Color space (e.g. sRGB)'),
      view_transform: z.string().optional().describe('View transform (e.g. AgX, Standard, Filmic)'),
      occupancy_min: z.number().optional().describe('Min occupancy for standard units'),
      occupancy_max: z.number().optional().describe('Max occupancy for standard units'),
      occupancy_min_large: z.number().optional().describe('Min occupancy for large units'),
      occupancy_max_large: z.number().optional().describe('Max occupancy for large units'),
      perimeter_complexity_max: z.number().optional().describe('Max perimeter complexity ratio'),
      pose_delta_min: z.number().optional().describe('Min pose delta (IoU change) for attack telegraph'),
      class_confusion_max_iou: z.number().optional().describe('Max IoU between different unit idles'),
      recognition_class_pct: z.number().optional().describe('Target % for 200ms class recognition'),
      recognition_action_pct: z.number().optional().describe('Target % for 200ms action recognition'),
      min_board_contrast: z.number().optional().describe('Min luminance contrast vs board background'),
      key_fill_ratio: z.number().optional().describe('Key-to-fill light ratio'),
      rim_intensity: z.number().optional().describe('Rim light intensity (0-1)'),
    },
    async (params) => {
      const db = getDb();
      const result = upsertRenderDoctrine(db, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
