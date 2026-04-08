import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { getProjectStatus } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioProjectStatus(server: McpServer): void {
  server.tool(
    'studio_project_status',
    'Get project status — template, bootstrap result, shell installation state, next step',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getProjectStatus(db, params.project_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
