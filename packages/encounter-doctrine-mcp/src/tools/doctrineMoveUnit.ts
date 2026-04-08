import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { moveUnit } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineMoveUnit(server: McpServer): void {
  server.tool(
    'doctrine_move_unit',
    'Move a unit to a new grid position or update facing/spawn_group',
    {
      encounter_id: z.string().describe('Encounter ID (for context)'),
      unit_id: z.number().int().describe('Unit row ID'),
      row: z.number().int().optional().describe('New grid row'),
      col: z.number().int().optional().describe('New grid column'),
      facing: z.string().optional().describe('New facing direction'),
      spawn_group: z.string().optional().describe('New spawn group'),
    },
    async (params) => {
      const db = getDb();

      const unit = moveUnit(db, params.unit_id, {
        grid_row: params.row,
        grid_col: params.col,
        facing: params.facing,
        spawn_group: params.spawn_group,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(unit) }] };
    }
  );
}
