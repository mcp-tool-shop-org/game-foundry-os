import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createSceneContract, transitionSceneContractState } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleCreateSceneContract(server: McpServer): void {
  server.tool(
    'battle_create_scene_contract',
    'Create scene contract from encounter',
    {
      project_id: z.string().describe('Project ID'),
      encounter_id: z.string().describe('Encounter ID'),
      tile_size_px: z.number().optional().describe('Tile size in pixels (default 64)'),
      viewport_width: z.number().optional().describe('Viewport width in pixels (default 1280)'),
      viewport_height: z.number().optional().describe('Viewport height in pixels (default 720)'),
    },
    async (params) => {
      const db = getDb();
      const overrides: Record<string, number> = {};
      if (params.tile_size_px !== undefined) overrides.tile_size_px = params.tile_size_px;
      if (params.viewport_width !== undefined) overrides.viewport_width = params.viewport_width;
      if (params.viewport_height !== undefined) overrides.viewport_height = params.viewport_height;

      const contract = createSceneContract(db, params.project_id, params.encounter_id, overrides);
      transitionSceneContractState(db, contract.id, 'contract_defined');

      return { content: [{ type: 'text' as const, text: JSON.stringify(contract, null, 2) }] };
    },
  );
}
