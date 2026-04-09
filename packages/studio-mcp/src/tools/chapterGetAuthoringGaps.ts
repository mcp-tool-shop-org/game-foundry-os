import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { computeAuthoringGaps } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterGetAuthoringGaps(server: McpServer): void {
  server.tool(
    'chapter_get_authoring_gaps',
    'Compute missing content for a chapter: roster gaps, missing scene contracts, unregistered variants, missing packs',
    {
      chapter_id: z.string().describe('Chapter ID'),
    },
    async (params) => {
      const db = getDb();
      const result = computeAuthoringGaps(db, params.chapter_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
