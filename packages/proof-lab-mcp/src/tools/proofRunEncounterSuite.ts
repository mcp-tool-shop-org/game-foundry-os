import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runEncounterSuite } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofRunEncounterSuite(server: McpServer): void {
  server.tool(
    'proof_run_encounter_suite',
    'Run encounter integrity proof suite for an encounter or chapter scope',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.enum(['encounter', 'chapter']).describe('Scope type'),
      scope_id: z.string().describe('Scope ID (encounter ID or chapter ID)'),
    },
    async (params) => {
      const db = getDb();
      const result = runEncounterSuite(db, params.project_id, params.scope_type, params.scope_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
