import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { scaffoldChapter } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterScaffold(server: McpServer): void {
  server.tool(
    'chapter_scaffold',
    'Scaffold a complete chapter from a brief: chapter contract, encounters with inherited defaults, scene contracts, UI layers',
    {
      project_id: z.string().describe('Project ID'),
      chapter_id: z.string().describe('Chapter identifier'),
      display_name: z.string().describe('Human-readable chapter name'),
      sort_order: z.number().optional().describe('Sort order'),
      intent_summary: z.string().optional().describe('Design intent summary'),
      encounters: z.array(z.object({
        encounter_id: z.string().describe('Unique encounter ID'),
        display_name: z.string().describe('Human-readable encounter name'),
        encounter_type: z.enum(['standard', 'boss', 'miniboss', 'gauntlet']).optional().describe('Encounter type override'),
        intent_summary: z.string().optional().describe('Encounter design intent'),
      })).describe('Encounters to scaffold'),
      defaults: z.object({
        default_grid_rows: z.number().int().optional(),
        default_grid_cols: z.number().int().optional(),
        default_tile_size_px: z.number().int().optional(),
        default_viewport_width: z.number().int().optional(),
        default_viewport_height: z.number().int().optional(),
        default_encounter_type: z.string().optional(),
        default_max_turns: z.number().int().nullable().optional(),
        require_scene_contract: z.boolean().optional(),
        require_ui_layers: z.boolean().optional(),
        require_proof_pass: z.boolean().optional(),
        require_playtest_pass: z.boolean().optional(),
        require_canon_link: z.boolean().optional(),
      }).optional().describe('Chapter authoring defaults'),
    },
    async (params) => {
      const db = getDb();
      const result = scaffoldChapter(db, {
        project_id: params.project_id,
        chapter_id: params.chapter_id,
        display_name: params.display_name,
        sort_order: params.sort_order,
        intent_summary: params.intent_summary,
        encounters: params.encounters,
        defaults: params.defaults,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
