import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getProofNextStep } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofGetNextStep(server: McpServer): void {
  server.tool(
    'proof_get_next_step',
    'Get the next recommended proof action for a scope',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();
      const result = getProofNextStep(db, params.project_id, params.scope_type, params.scope_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
