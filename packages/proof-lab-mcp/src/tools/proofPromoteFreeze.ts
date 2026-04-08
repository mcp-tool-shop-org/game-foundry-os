import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { promoteFreeze } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofPromoteFreeze(server: McpServer): void {
  server.tool(
    'proof_promote_freeze',
    'Promote a freeze candidate to frozen — creates freeze receipt and state event',
    {
      project_id: z.string().describe('Project ID'),
      candidate_id: z.string().describe('Freeze candidate ID to promote'),
      override_reason: z.string().optional().describe('Reason for override (if any)'),
    },
    async (params) => {
      const db = getDb();
      try {
        const result = promoteFreeze(db, params.project_id, params.candidate_id, params.override_reason);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      } catch (err) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: (err as Error).message }) }] };
      }
    },
  );
}
