import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createFreezeCandidate } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofFreezeCandidate(server: McpServer): void {
  server.tool(
    'proof_freeze_candidate',
    'Create a freeze candidate for a scope — snapshots current readiness',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();
      const result = createFreezeCandidate(db, params.project_id, params.scope_type, params.scope_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
