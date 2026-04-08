import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computeChapterHealth } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterRunFullProof(server: McpServer): void {
  server.tool(
    'chapter_run_full_proof',
    'Run proof spine + battle scene proof for entire chapter',
    {
      chapter_id: z.string().describe('Chapter ID'),
    },
    async (params) => {
      const db = getDb();
      const result = computeChapterHealth(db, params.chapter_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
