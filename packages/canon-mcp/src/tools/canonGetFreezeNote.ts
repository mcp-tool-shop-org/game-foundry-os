import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getLinksTo, getPage } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGetFreezeNote(server: McpServer): void {
  server.tool(
    'canon_get_freeze_note',
    'Find canon page with kind=proof_note linked to a scope',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();

      const links = getLinksTo(db, params.scope_type, params.scope_id);
      const freezeNotes = [];

      for (const link of links) {
        if (link.link_type === 'freeze_note_for' || link.link_type === 'proves') {
          const page = getPage(db, link.source_canon_id);
          if (page && page.kind === 'proof_note') {
            freezeNotes.push(page);
          }
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            scope: `${params.scope_type}:${params.scope_id}`,
            freeze_notes: freezeNotes,
            count: freezeNotes.length,
          }),
        }],
      };
    },
  );
}
