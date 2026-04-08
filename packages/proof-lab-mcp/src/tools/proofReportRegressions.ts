import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { detectRegressions, listRegressions } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofReportRegressions(server: McpServer): void {
  server.tool(
    'proof_report_regressions',
    'Detect and list regressions for a scope',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();
      const detected = detectRegressions(db, params.project_id, params.scope_type, params.scope_id);
      const all = listRegressions(db, params.project_id, params.scope_type, params.scope_id);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            newly_detected: detected.regressions_found,
            new_regressions: detected.new_regressions,
            all_regressions: all,
          }),
        }],
      };
    },
  );
}
