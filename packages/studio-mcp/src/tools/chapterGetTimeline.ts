import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getChapter } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterGetTimeline(server: McpServer): void {
  server.tool(
    'chapter_get_timeline',
    'Chronological events across all chapter encounters',
    {
      chapter_id: z.string().describe('Chapter ID'),
    },
    async (params) => {
      const db = getDb();
      const chapter = getChapter(db, params.chapter_id);
      if (!chapter) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Chapter not found: ${params.chapter_id}` }, null, 2) }],
        };
      }
      const events = db.prepare(
        `SELECT * FROM state_events
         WHERE (project_id = ? AND entity_type = 'chapter' AND entity_id = ?)
            OR (entity_type IN ('encounter','battle_scene','repair')
                AND entity_id IN (SELECT id FROM encounters WHERE chapter = ?))
         ORDER BY created_at`,
      ).all(chapter.project_id, params.chapter_id, params.chapter_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(events, null, 2) }],
      };
    },
  );
}
