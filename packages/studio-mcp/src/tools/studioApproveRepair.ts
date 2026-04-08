import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { approveRepairPlan } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioApproveRepair(server: McpServer): void {
  server.tool(
    'studio_approve_repair',
    'Approve a pending moderate-risk repair plan — required before apply for approval_required plans',
    {
      plan_id: z.string().describe('Repair plan ID'),
      approved_by: z.string().describe('Who is approving'),
    },
    async (params) => {
      const db = getDb();
      try {
        const result = approveRepairPlan(db, params.plan_id, params.approved_by);
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
