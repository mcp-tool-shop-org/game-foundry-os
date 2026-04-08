import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { planRepair } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioPlanRepair(server: McpServer): void {
  server.tool(
    'studio_plan_repair',
    'Plan a repair action for diagnostic findings — produces stepwise plan with dry-run support',
    {
      project_id: z.string().describe('Project ID'),
      finding_ids: z.array(z.string()).describe('Finding IDs to repair'),
      action_key: z.string().describe('Repair action key from the catalog'),
      project_root: z.string().describe('Absolute path to project root'),
    },
    async (params) => {
      const db = getDb();
      try {
        const result = planRepair(
          db,
          params.project_id,
          params.finding_ids,
          params.action_key,
          params.project_root,
          params.project_root,
        );
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: (err as Error).message }) }],
        };
      }
    },
  );
}
