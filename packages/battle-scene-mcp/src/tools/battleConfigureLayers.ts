import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { configureDefaultLayers, transitionSceneContractState } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleConfigureLayers(server: McpServer): void {
  server.tool(
    'battle_configure_layers',
    'Configure all 5 UI layers with defaults',
    {
      contract_id: z.string().describe('Contract ID'),
    },
    async (params) => {
      const db = getDb();
      const layers = configureDefaultLayers(db, params.contract_id);
      transitionSceneContractState(db, params.contract_id, 'layers_configured');

      return { content: [{ type: 'text' as const, text: JSON.stringify(layers, null, 2) }] };
    },
  );
}
