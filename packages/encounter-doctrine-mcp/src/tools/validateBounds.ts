import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateBounds } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerValidateBounds(server: McpServer): void {
  server.tool(
    'validate_bounds',
    'Check that all enemy positions fall within the encounter grid dimensions',
    { encounter_id: z.string().describe('Encounter ID to validate') },
    async ({ encounter_id }) => {
      const result = validateBounds(getDb(), encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );
}
