import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEncounter, getEncounterEnemies } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerGetEncounter(server: McpServer): void {
  server.tool(
    'get_encounter',
    'Get a single encounter definition with its enemies',
    { encounter_id: z.string().describe('Encounter ID to retrieve') },
    async ({ encounter_id }) => {
      const db = getDb();
      const encounter = getEncounter(db, encounter_id);
      if (!encounter) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Encounter not found: ${encounter_id}` }) }],
          isError: true,
        };
      }
      const enemies = getEncounterEnemies(db, encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ...encounter, enemies }) }] };
    }
  );
}
