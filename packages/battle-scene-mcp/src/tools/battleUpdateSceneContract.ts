import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSceneContract } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerBattleUpdateSceneContract(server: McpServer): void {
  server.tool(
    'battle_update_scene_contract',
    'Update contract fields (tile_size, hud_zones, thresholds)',
    {
      contract_id: z.string().describe('Contract ID'),
      tile_size_px: z.number().optional().describe('Tile size in pixels'),
      min_unit_contrast: z.number().optional().describe('Minimum unit contrast threshold'),
      max_hud_overlap_pct: z.number().optional().describe('Maximum HUD overlap percentage'),
      hud_zones_json: z.string().optional().describe('HUD zones as JSON string'),
      viewport_width: z.number().optional().describe('Viewport width in pixels'),
      viewport_height: z.number().optional().describe('Viewport height in pixels'),
    },
    async (params) => {
      const db = getDb();

      const sets: string[] = [];
      const values: unknown[] = [];

      if (params.tile_size_px !== undefined) { sets.push('tile_size_px = ?'); values.push(params.tile_size_px); }
      if (params.min_unit_contrast !== undefined) { sets.push('min_unit_contrast = ?'); values.push(params.min_unit_contrast); }
      if (params.max_hud_overlap_pct !== undefined) { sets.push('max_hud_overlap_pct = ?'); values.push(params.max_hud_overlap_pct); }
      if (params.hud_zones_json !== undefined) { sets.push('hud_zones_json = ?'); values.push(params.hud_zones_json); }
      if (params.viewport_width !== undefined) { sets.push('viewport_width = ?'); values.push(params.viewport_width); }
      if (params.viewport_height !== undefined) { sets.push('viewport_height = ?'); values.push(params.viewport_height); }

      if (sets.length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No fields to update' }) }] };
      }

      values.push(params.contract_id);
      db.prepare(`UPDATE battle_scene_contracts SET ${sets.join(', ')} WHERE id = ?`).run(...values);

      const updated = getSceneContract(db, params.contract_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(updated, null, 2) }] };
    },
  );
}
