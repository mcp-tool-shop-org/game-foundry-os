import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateVariants } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerValidateVariants(server: McpServer): void {
  server.tool(
    'validate_variants',
    'Check that all referenced sprite variants and packs exist in the registry',
    { encounter_id: z.string().describe('Encounter ID to validate') },
    async ({ encounter_id }) => {
      const result = validateVariants(getDb(), encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );
}
