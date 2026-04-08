import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { removeUnit, getUnitCount } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineRemoveUnit(server: McpServer): void {
  server.tool(
    'doctrine_remove_unit',
    'Remove a unit from the encounter roster',
    {
      encounter_id: z.string().describe('Encounter ID (for context)'),
      unit_id: z.number().int().describe('Unit row ID to remove'),
    },
    async (params) => {
      const db = getDb();
      removeUnit(db, params.unit_id);
      const remaining = getUnitCount(db, params.encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ removed: params.unit_id, remaining_units: remaining }) }] };
    }
  );
}
