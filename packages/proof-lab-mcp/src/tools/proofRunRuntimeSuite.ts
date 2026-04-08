import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runRuntimeSuite } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofRunRuntimeSuite(server: McpServer): void {
  server.tool(
    'proof_run_runtime_suite',
    'Run runtime integrity proof suite — checks filesystem presence of sprite packs',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.enum(['variant', 'chapter', 'project']).describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
      project_root: z.string().describe('Absolute path to project root'),
    },
    async (params) => {
      const db = getDb();
      const result = runRuntimeSuite(db, params.project_id, params.scope_type, params.scope_id, params.project_root);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
