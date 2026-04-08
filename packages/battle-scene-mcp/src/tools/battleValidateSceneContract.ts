import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateSceneContract } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleValidateSceneContract(server: McpServer): void {
  server.tool(
    'battle_validate_scene_contract',
    'Validate contract consistency (board fits viewport, HUD zones valid)',
    {
      contract_id: z.string().describe('Contract ID'),
    },
    async (params) => {
      const db = getDb();
      const result = validateSceneContract(db, params.contract_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
