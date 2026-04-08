import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computePlaytestReadability } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleGetSceneReadability(server: McpServer): void {
  server.tool(
    'battle_get_scene_readability',
    'Compute readability score from latest proof + playtest results',
    {
      encounter_id: z.string().describe('Encounter ID'),
    },
    async (params) => {
      const db = getDb();
      const result = computePlaytestReadability(db, params.encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
