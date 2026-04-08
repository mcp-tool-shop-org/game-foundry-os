import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getFreezeReadiness } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofGetFreezeReadiness(server: McpServer): void {
  server.tool(
    'proof_get_freeze_readiness',
    'Check freeze readiness for a scope — returns readiness status, blockers, and warnings',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type (variant, chapter, encounter)'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getFreezeReadiness(db, params.project_id, params.scope_type, params.scope_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
