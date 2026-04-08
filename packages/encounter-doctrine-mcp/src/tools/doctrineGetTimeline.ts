import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEncounterTimeline } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineGetTimeline(server: McpServer): void {
  server.tool(
    'doctrine_get_timeline',
    'Get a chronological timeline of all encounter events (state changes, validations, exports, syncs)',
    {
      encounter_id: z.string().describe('Encounter ID'),
    },
    async (params) => {
      const db = getDb();
      const timeline = getEncounterTimeline(db, params.encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(timeline) }] };
    }
  );
}
