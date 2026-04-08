import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getCanonTimeline } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGetTimeline(server: McpServer): void {
  server.tool(
    'canon_get_timeline',
    'Get chronological timeline of all canon events for a page (syncs, links, snapshots, drift, handoffs)',
    {
      project_id: z.string().describe('Project ID'),
      canon_id: z.string().describe('Canon page identifier'),
    },
    async (params) => {
      const db = getDb();
      const timeline = getCanonTimeline(db, params.project_id, params.canon_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ count: timeline.length, entries: timeline }) }] };
    },
  );
}
