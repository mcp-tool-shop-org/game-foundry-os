import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { compareSnapshots } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonCompareSnapshots(server: McpServer): void {
  server.tool(
    'canon_compare_snapshots',
    'Compare two canon page snapshots to see what changed',
    {
      snapshot_id_a: z.string().describe('First snapshot ID'),
      snapshot_id_b: z.string().describe('Second snapshot ID'),
    },
    async (params) => {
      const db = getDb();
      const result = compareSnapshots(db, params.snapshot_id_a, params.snapshot_id_b);
      if (!result) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'One or both snapshots not found' }) }] };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
