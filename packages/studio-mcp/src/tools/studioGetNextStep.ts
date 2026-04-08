import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { getStudioNextStep } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioGetNextStep(server: McpServer): void {
  server.tool(
    'studio_get_next_step',
    'Get the next recommended action for a project based on bootstrap and production state',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getStudioNextStep(db, params.project_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
