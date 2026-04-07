import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getPack } from '@mcptoolshop/game-foundry-registry';
import type { VariantRow } from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerGetPackManifest(server: McpServer, db: Database.Database): void {
  server.tool(
    'get_pack_manifest',
    'Get pack info and its member variants from the registry',
    {
      pack_id: z.string().describe('Asset pack ID'),
    },
    async ({ pack_id }) => {
      const pack = getPack(db, pack_id);
      if (!pack) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Pack not found: ${pack_id}` }) }],
          isError: true,
        };
      }

      const members = db.prepare('SELECT * FROM variants WHERE pack_id = ? ORDER BY character_id')
        .all(pack_id) as VariantRow[];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            pack,
            members,
            member_count: members.length,
          }, null, 2),
        }],
      };
    },
  );
}
