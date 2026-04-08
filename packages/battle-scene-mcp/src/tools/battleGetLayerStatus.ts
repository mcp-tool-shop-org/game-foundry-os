import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getLayerStatus } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleGetLayerStatus(server: McpServer): void {
  server.tool(
    'battle_get_layer_status',
    'Get all layers for a contract with their validation state',
    {
      contract_id: z.string().describe('Contract ID'),
    },
    async (params) => {
      const db = getDb();
      const layers = getLayerStatus(db, params.contract_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(layers, null, 2) }] };
    },
  );
}
