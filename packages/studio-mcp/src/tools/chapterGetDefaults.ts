import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getChapterDefaults, resolveDefaults } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterGetDefaults(server: McpServer): void {
  server.tool(
    'chapter_get_defaults',
    'Get resolved authoring defaults for a chapter (explicit + fallback system defaults)',
    {
      chapter_id: z.string().describe('Chapter ID'),
    },
    async (params) => {
      const db = getDb();
      const raw = getChapterDefaults(db, params.chapter_id);
      const resolved = resolveDefaults(db, params.chapter_id);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            explicit_defaults: raw ?? null,
            resolved_defaults: resolved,
            has_explicit_defaults: !!raw,
          }, null, 2),
        }],
      };
    },
  );
}
