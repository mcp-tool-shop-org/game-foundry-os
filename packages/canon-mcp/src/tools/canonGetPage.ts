import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPage } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGetPage(server: McpServer): void {
  server.tool(
    'canon_get_page',
    'Get a canon page by its canon_id',
    {
      canon_id: z.string().describe('Canon page identifier'),
    },
    async (params) => {
      const db = getDb();
      const page = getPage(db, params.canon_id);
      if (!page) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Page not found' }) }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(page) }] };
    },
  );
}
