import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { syncToEngine, canEncounterTransition, transitionEncounterState, getEncounterProductionState } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineSyncToEngine(server: McpServer): void {
  server.tool(
    'doctrine_sync_to_engine',
    'Sync encounter manifest to engine runtime path. Transitions to engine_synced.',
    {
      encounter_id: z.string().describe('Encounter ID'),
      project_id: z.string().describe('Project ID'),
      target_runtime_path: z.string().describe('Target runtime path for manifest'),
    },
    async (params) => {
      const db = getDb();

      const result = syncToEngine(db, params.encounter_id, params.project_id, params.target_runtime_path);

      let transition = null;
      const currentState = getEncounterProductionState(db, params.encounter_id);
      if (canEncounterTransition(currentState, 'engine_synced')) {
        transition = transitionEncounterState(db, params.encounter_id, 'engine_synced', {
          reason: 'Synced to engine',
          toolName: 'doctrine_sync_to_engine',
        });
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ ...result, transition }) }] };
    }
  );
}
