import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runSceneProof } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleRunSceneProof(server: McpServer): void {
  server.tool(
    'battle_run_scene_proof',
    'Run the 13-assertion proof suite',
    {
      contract_id: z.string().describe('Contract ID'),
    },
    async (params) => {
      const db = getDb();
      const result = runSceneProof(db, params.contract_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
