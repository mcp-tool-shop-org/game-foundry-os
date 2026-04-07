import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getCharacterTimeline } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryGetCharacterTimeline(server: McpServer, db: Database.Database): void {
  server.tool(
    'get_character_timeline',
    'Get the full production timeline across all variants of a character',
    {
      character_id: z.string().describe('Character ID to get timeline for'),
    },
    async (args) => {
      try {
        const timeline = getCharacterTimeline(db, args.character_id);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ character_id: args.character_id, entries: timeline, count: timeline.length }, null, 2),
          }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
