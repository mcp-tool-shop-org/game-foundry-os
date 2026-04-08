import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getChapterMatrix } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineGetChapterMatrix(server: McpServer): void {
  server.tool(
    'doctrine_get_chapter_matrix',
    'Get all encounters for a chapter with their states, validation, and export/sync status',
    {
      project_id: z.string().describe('Project ID'),
      chapter: z.string().describe('Chapter identifier'),
    },
    async (params) => {
      const db = getDb();
      const matrix = getChapterMatrix(db, params.project_id, params.chapter);
      return { content: [{ type: 'text' as const, text: JSON.stringify(matrix) }] };
    }
  );
}
