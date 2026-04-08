import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listChapters } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterList(server: McpServer): void {
  server.tool(
    'chapter_list',
    'List all chapters for a project with health summary',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const result = listChapters(db, params.project_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
