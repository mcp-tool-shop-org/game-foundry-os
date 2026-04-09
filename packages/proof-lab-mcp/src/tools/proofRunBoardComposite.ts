import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runBoardCompositeSuite } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofRunBoardComposite(server: McpServer): void {
  server.tool(
    'proof_run_board_composite',
    'Run board composite proof suite — tests sprite visibility against simulated board backgrounds (dark, mid, noisy). Checks contrast survival, gameplay scale readability, and alpha correctness.',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.enum(['variant', 'chapter']).describe('Scope type'),
      scope_id: z.string().describe('Scope ID (variant ID or chapter ID)'),
      project_root: z.string().describe('Absolute path to project root'),
    },
    async (params) => {
      const db = getDb();
      const result = runBoardCompositeSuite(
        db,
        params.project_id,
        params.scope_type,
        params.scope_id,
        params.project_root,
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
