import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateLayerDependencies } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleValidateLayerDependencies(server: McpServer): void {
  server.tool(
    'battle_validate_layer_dependencies',
    'Check that encounter data supports all configured layers',
    {
      contract_id: z.string().describe('Contract ID'),
    },
    async (params) => {
      const db = getDb();
      const result = validateLayerDependencies(db, params.contract_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
