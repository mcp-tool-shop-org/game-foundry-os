import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runAssetSuite } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofRunAssetSuite(server: McpServer): void {
  server.tool(
    'proof_run_asset_suite',
    'Run asset integrity proof suite for a variant or chapter scope',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.enum(['variant', 'chapter']).describe('Scope type'),
      scope_id: z.string().describe('Scope ID (variant ID or chapter ID)'),
    },
    async (params) => {
      const db = getDb();
      const result = runAssetSuite(db, params.project_id, params.scope_type, params.scope_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
