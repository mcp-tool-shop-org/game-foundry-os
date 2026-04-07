import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listEncounters } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerListEncounters(server: McpServer): void {
  server.tool(
    'list_encounters',
    'List encounter definitions with optional project and chapter filters',
    {
      project_id: z.string().optional().describe('Filter by project ID'),
      chapter: z.string().optional().describe('Filter by chapter'),
    },
    async ({ project_id, chapter }) => {
      const filters: { project_id?: string; chapter?: string } = {};
      if (project_id) filters.project_id = project_id;
      if (chapter) filters.chapter = chapter;
      const result = listEncounters(getDb(), Object.keys(filters).length > 0 ? filters : undefined);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );
}
