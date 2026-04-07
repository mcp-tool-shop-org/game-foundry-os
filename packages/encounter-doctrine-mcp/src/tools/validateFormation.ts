import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateFormation } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerValidateFormation(server: McpServer): void {
  server.tool(
    'validate_formation',
    'Check formation rules: no overlapping positions, count fits grid capacity',
    { encounter_id: z.string().describe('Encounter ID to validate') },
    async ({ encounter_id }) => {
      const result = validateFormation(getDb(), encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );
}
