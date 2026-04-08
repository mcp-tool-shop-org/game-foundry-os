import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getLinksTo, getPage } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGetCharacterBible(server: McpServer): void {
  server.tool(
    'canon_get_character_bible',
    'Get character canon page + linked variants + production state summary',
    {
      project_id: z.string().describe('Project ID'),
      character_id: z.string().describe('Character ID'),
    },
    async (params) => {
      const db = getDb();

      // Find canon links TO this character
      const links = getLinksTo(db, 'character', params.character_id);
      const canonPages = links
        .map((l) => getPage(db, l.source_canon_id))
        .filter(Boolean);

      // Get character production state
      const character = db.prepare('SELECT * FROM characters WHERE id = ?')
        .get(params.character_id) as Record<string, unknown> | undefined;

      if (!character) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Character not found' }) }] };
      }

      // Get variants
      const variants = db.prepare('SELECT id, variant_type, production_state, portrait_state FROM variants WHERE character_id = ?')
        .all(params.character_id) as Array<Record<string, unknown>>;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            character_id: params.character_id,
            display_name: character.display_name,
            canon_pages: canonPages,
            production: {
              concept_status: character.concept_status,
              directional_status: character.directional_status,
              sheet_status: character.sheet_status,
              pack_status: character.pack_status,
              portrait_status: character.portrait_status,
              integration_status: character.integration_status,
              freeze_status: character.freeze_status,
            },
            variants,
          }),
        }],
      };
    },
  );
}
