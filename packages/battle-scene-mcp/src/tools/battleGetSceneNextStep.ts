import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSceneContract } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

/** Map production state to the next required action */
const NEXT_ACTIONS: Record<string, { action: string; description: string }> = {
  draft: { action: 'create_contract', description: 'Define scene contract from encounter (battle_create_scene_contract)' },
  contract_defined: { action: 'configure_layers', description: 'Configure the 5 UI layers (battle_configure_layers)' },
  layers_configured: { action: 'capture_snapshots', description: 'Capture all 5 canonical snapshots (battle_capture_snapshot)' },
  snapshots_captured: { action: 'run_proof', description: 'Run the 13-assertion proof suite (battle_run_scene_proof)' },
  proof_passed: { action: 'freeze', description: 'Promote to frozen via proof freeze pipeline' },
  frozen: { action: 'none', description: 'Scene contract is frozen — no further actions required' },
};

export function registerBattleGetSceneNextStep(server: McpServer): void {
  server.tool(
    'battle_get_scene_next_step',
    'Next action to advance the scene contract through its pipeline',
    {
      contract_id: z.string().describe('Contract ID'),
    },
    async (params) => {
      const db = getDb();
      const contract = getSceneContract(db, params.contract_id);

      if (!contract) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Scene contract not found' }) }] };
      }

      const state = contract.production_state as string;
      const next = NEXT_ACTIONS[state] ?? { action: 'unknown', description: `Unknown state: ${state}` };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            contract_id: contract.id,
            current_state: state,
            next_action: next.action,
            description: next.description,
          }, null, 2),
        }],
      };
    },
  );
}
