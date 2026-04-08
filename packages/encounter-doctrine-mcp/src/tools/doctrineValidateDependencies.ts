import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateDependencies, canEncounterTransition, transitionEncounterState, getEncounterProductionState } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineValidateDependencies(server: McpServer): void {
  server.tool(
    'doctrine_validate_dependencies',
    'Validate that all variants and sprite packs referenced by the encounter exist. If pass, transitions to dependencies_resolved.',
    {
      encounter_id: z.string().describe('Encounter ID to validate'),
    },
    async (params) => {
      const db = getDb();

      const report = validateDependencies(db, params.encounter_id);

      let transition = null;
      if (report.pass) {
        const currentState = getEncounterProductionState(db, params.encounter_id);
        if (canEncounterTransition(currentState, 'dependencies_resolved')) {
          transition = transitionEncounterState(db, params.encounter_id, 'dependencies_resolved', {
            reason: 'Dependency validation passed',
            toolName: 'doctrine_validate_dependencies',
          });
        }
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ ...report, transition }) }] };
    }
  );
}
