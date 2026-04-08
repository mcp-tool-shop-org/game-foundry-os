import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getLinksTo, getPage } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGetEncounterIntent(server: McpServer): void {
  server.tool(
    'canon_get_encounter_intent',
    'Get encounter canon page + linked encounter manifest + production state',
    {
      project_id: z.string().describe('Project ID'),
      encounter_id: z.string().describe('Encounter ID'),
    },
    async (params) => {
      const db = getDb();

      const links = getLinksTo(db, 'encounter', params.encounter_id);
      const canonPages = links
        .map((l) => getPage(db, l.source_canon_id))
        .filter(Boolean);

      const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?')
        .get(params.encounter_id) as Record<string, unknown> | undefined;

      if (!encounter) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Encounter not found' }) }] };
      }

      const enemies = db.prepare('SELECT display_name, variant_id, sprite_pack, grid_row, grid_col FROM encounter_enemies WHERE encounter_id = ? ORDER BY sort_order')
        .all(params.encounter_id) as Array<Record<string, unknown>>;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            encounter_id: params.encounter_id,
            display_name: encounter.display_name ?? encounter.label,
            intent_summary: encounter.intent_summary,
            canon_pages: canonPages,
            production: {
              production_state: encounter.production_state,
              runtime_sync_state: encounter.runtime_sync_state,
              encounter_type: encounter.encounter_type,
              route_tag: encounter.route_tag,
            },
            enemies,
          }),
        }],
      };
    },
  );
}
