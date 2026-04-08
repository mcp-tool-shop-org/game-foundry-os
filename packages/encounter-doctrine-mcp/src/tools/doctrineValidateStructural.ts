import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateStructural, canEncounterTransition, transitionEncounterState, getEncounterProductionState } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineValidateStructural(server: McpServer): void {
  server.tool(
    'doctrine_validate_structural',
    'Run structural validation (bounds + formation + arena sanity + team presence). If pass, transitions to validated_structural.',
    {
      encounter_id: z.string().describe('Encounter ID to validate'),
    },
    async (params) => {
      const db = getDb();

      const report = validateStructural(db, params.encounter_id);

      let transition = null;
      if (report.pass) {
        const currentState = getEncounterProductionState(db, params.encounter_id);
        if (canEncounterTransition(currentState, 'validated_structural')) {
          transition = transitionEncounterState(db, params.encounter_id, 'validated_structural', {
            reason: 'Structural validation passed',
            toolName: 'doctrine_validate_structural',
          });
        }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ ...report, transition }) }] };
    }
  );
}
