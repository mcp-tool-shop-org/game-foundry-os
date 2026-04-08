import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCanonNextStep } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGetNextStep(server: McpServer): void {
  server.tool(
    'canon_get_next_step',
    'Get the next recommended action for the canon layer of a project',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getCanonNextStep(db, params.project_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
