import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getProofTimeline } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofGetTimeline(server: McpServer): void {
  server.tool(
    'proof_get_timeline',
    'Get chronological proof timeline for a scope — proof runs, freeze events, regressions',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();
      const timeline = getProofTimeline(db, params.project_id, params.scope_type, params.scope_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(timeline) }] };
    },
  );
}
