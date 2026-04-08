import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { computeQualityStates, getWeakestDomain, persistQualityStates } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioGetQualityState(server: McpServer): void {
  server.tool(
    'studio_get_quality_state',
    'Returns per-domain quality scores for a project — visual, runtime, encounter, canon, playability, shipping',
    {
      project_id: z.string().describe('Project ID'),
      project_root: z.string().describe('Absolute path to project root'),
    },
    async (params) => {
      const db = getDb();
      try {
        const states = computeQualityStates(db, params.project_id, params.project_root);
        persistQualityStates(db, params.project_id, states);
        const weakest = getWeakestDomain(states);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              project_id: params.project_id,
              domains: states,
              weakest_domain: weakest,
              overall: states.every(s => s.status === 'healthy') ? 'healthy' : weakest?.status ?? 'unknown',
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: (err as Error).message }) }],
        };
      }
    },
  );
}
