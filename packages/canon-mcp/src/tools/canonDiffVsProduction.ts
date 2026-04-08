import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { detectDrift } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonDiffVsProduction(server: McpServer): void {
  server.tool(
    'canon_diff_vs_production',
    'Compare canon page claims vs registry truth for a character, encounter, or chapter',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type: character, encounter, or chapter'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();
      const result = detectDrift(db, params.project_id, params.scope_type, params.scope_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
