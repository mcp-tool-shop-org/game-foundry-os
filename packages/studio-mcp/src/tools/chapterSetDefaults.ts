import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { setChapterDefaults } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterSetDefaults(server: McpServer): void {
  server.tool(
    'chapter_set_defaults',
    'Set authoring defaults for a chapter — grid size, tile size, viewport, quality gates. New encounters inherit these.',
    {
      chapter_id: z.string().describe('Chapter ID'),
      project_id: z.string().describe('Project ID'),
      default_grid_rows: z.number().int().optional().describe('Default grid rows for encounters'),
      default_grid_cols: z.number().int().optional().describe('Default grid columns for encounters'),
      default_encounter_type: z.enum(['standard', 'boss', 'miniboss', 'gauntlet']).optional().describe('Default encounter type'),
      default_max_turns: z.number().int().nullable().optional().describe('Default max turns'),
      default_tile_size_px: z.number().int().optional().describe('Default tile size in pixels'),
      default_viewport_width: z.number().int().optional().describe('Default viewport width'),
      default_viewport_height: z.number().int().optional().describe('Default viewport height'),
      require_scene_contract: z.boolean().optional().describe('Require scene contracts for encounters'),
      require_ui_layers: z.boolean().optional().describe('Require UI layers for scene contracts'),
      require_proof_pass: z.boolean().optional().describe('Require proof pass'),
      require_playtest_pass: z.boolean().optional().describe('Require playtest pass'),
      require_canon_link: z.boolean().optional().describe('Require canon documentation link'),
    },
    async (params) => {
      const db = getDb();
      const result = setChapterDefaults(db, params);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
