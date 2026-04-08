import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getSceneContract,
  getSceneContractByEncounter,
  getLayersByContract,
  getSnapshotsByContract,
} from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerBattleGetSceneContract(server: McpServer): void {
  server.tool(
    'battle_get_scene_contract',
    'Get contract with its layers and snapshots',
    {
      contract_id: z.string().optional().describe('Contract ID'),
      encounter_id: z.string().optional().describe('Encounter ID (alternative lookup)'),
    },
    async (params) => {
      const db = getDb();

      const contract = params.contract_id
        ? getSceneContract(db, params.contract_id)
        : params.encounter_id
          ? getSceneContractByEncounter(db, params.encounter_id)
          : null;

      if (!contract) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Scene contract not found' }) }] };
      }

      const layers = getLayersByContract(db, contract.id);
      const snapshots = getSnapshotsByContract(db, contract.id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ contract, layers, snapshots }, null, 2),
        }],
      };
    },
  );
}
