import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEncounterCoverageMap } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterGetCoverageMap(server: McpServer): void {
  server.tool(
    'chapter_get_coverage_map',
    'Per-encounter coverage: contracts, proofs, playtests, findings',
    {
      chapter_id: z.string().describe('Chapter ID'),
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getEncounterCoverageMap(db, params.chapter_id, params.project_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
