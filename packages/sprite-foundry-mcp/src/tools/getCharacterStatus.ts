import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getCharacterStatus } from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetCharacterStatus(server: McpServer, db: Database.Database): void {
  server.tool(
    'get_character_status',
    'Get production status of a character including all variants and next pipeline step',
    { character_id: z.string().describe('Character ID to look up') },
    async ({ character_id }) => {
      const status = getCharacterStatus(db, character_id);
      if (!status) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Character not found: ${character_id}` }) }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
      };
    },
  );
}
