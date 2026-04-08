import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { startPlaytest } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleStartPlaytest(server: McpServer): void {
  server.tool(
    'battle_start_playtest',
    'Begin a playtest session for an encounter',
    {
      project_id: z.string().describe('Project ID'),
      encounter_id: z.string().describe('Encounter ID'),
    },
    async (params) => {
      const db = getDb();
      const session = startPlaytest(db, params.project_id, params.encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(session, null, 2) }] };
    },
  );
}
