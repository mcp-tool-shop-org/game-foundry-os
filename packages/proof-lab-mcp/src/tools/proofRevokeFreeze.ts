import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { revokeFreeze } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofRevokeFreeze(server: McpServer): void {
  server.tool(
    'proof_revoke_freeze',
    'Revoke a frozen scope — creates regression record and revokes promoted candidates',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
      reason: z.string().describe('Reason for revoking the freeze'),
    },
    async (params) => {
      const db = getDb();
      revokeFreeze(db, params.project_id, params.scope_type, params.scope_id, params.reason);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, message: `Freeze revoked for ${params.scope_type}:${params.scope_id}` }) }] };
    },
  );
}
