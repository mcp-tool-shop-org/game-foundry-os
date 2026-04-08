import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runVisualSuite } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofRunVisualSuite(server: McpServer): void {
  server.tool(
    'proof_run_visual_suite',
    'Run visual integrity proof suite — checks transparency, occupancy, tile fit, contrast, silhouette. Blocks promotion if failed.',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.enum(['variant', 'chapter']).describe('Scope type'),
      scope_id: z.string().describe('Scope ID (variant ID or chapter ID)'),
      project_root: z.string().describe('Absolute path to project root'),
    },
    async (params) => {
      const db = getDb();
      const result = runVisualSuite(db, params.project_id, params.scope_type, params.scope_id, params.project_root);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
