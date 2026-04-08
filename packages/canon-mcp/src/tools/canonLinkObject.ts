import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { linkObject } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonLinkObject(server: McpServer): void {
  server.tool(
    'canon_link_object',
    'Link a canon page to a runtime object (character, encounter, chapter, etc.)',
    {
      project_id: z.string().describe('Project ID'),
      source_canon_id: z.string().describe('Canon ID of the source page'),
      target_type: z.string().describe('Target object type (character, encounter, chapter, etc.)'),
      target_id: z.string().describe('Target object ID'),
      link_type: z.string().describe('Link relationship type (describes, governs, proves, tracks, etc.)'),
    },
    async (params) => {
      const db = getDb();
      const link = linkObject(db, {
        project_id: params.project_id,
        source_canon_id: params.source_canon_id,
        target_type: params.target_type,
        target_id: params.target_id,
        link_type: params.link_type,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(link) }] };
    },
  );
}
