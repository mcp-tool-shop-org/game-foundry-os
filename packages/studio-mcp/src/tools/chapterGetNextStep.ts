import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getChapterNextStep } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterGetNextStep(server: McpServer): void {
  server.tool(
    'chapter_get_next_step',
    'Best next move for the chapter',
    {
      chapter_id: z.string().describe('Chapter ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getChapterNextStep(db, params.chapter_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
