import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getNextStep } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryGetNextStep(server: McpServer, db: Database.Database): void {
  server.tool(
    'get_next_step',
    'Get the next required action for a variant based on its production state and receipts',
    {
      variant_id: z.string().describe('Variant ID to check'),
    },
    async (args) => {
      try {
        const result = getNextStep(db, args.variant_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
