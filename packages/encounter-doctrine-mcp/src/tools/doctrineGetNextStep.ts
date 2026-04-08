import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEncounterNextStep } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineGetNextStep(server: McpServer): void {
  server.tool(
    'doctrine_get_next_step',
    'Get the next action needed to advance an encounter through the production pipeline',
    {
      encounter_id: z.string().describe('Encounter ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getEncounterNextStep(db, params.encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );
}
