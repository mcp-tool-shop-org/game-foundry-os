import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getChapterPlaytestStatus } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterGetPlaytestStatus(server: McpServer): void {
  server.tool(
    'chapter_get_playtest_status',
    'Aggregated playtest bundle for the chapter',
    {
      chapter_id: z.string().describe('Chapter ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getChapterPlaytestStatus(db, params.chapter_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
