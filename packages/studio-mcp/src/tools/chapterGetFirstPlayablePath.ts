import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computeFirstPlayablePath } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterGetFirstPlayablePath(server: McpServer): void {
  server.tool(
    'chapter_get_first_playable_path',
    'Ordered steps from current state to first-playable chapter. Each step: done/pending/blocked.',
    {
      chapter_id: z.string().describe('Chapter ID'),
    },
    async (params) => {
      const db = getDb();
      const result = computeFirstPlayablePath(db, params.chapter_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
