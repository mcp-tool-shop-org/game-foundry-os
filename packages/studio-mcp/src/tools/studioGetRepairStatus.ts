import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';

export function registerStudioGetRepairStatus(server: McpServer): void {
  server.tool(
    'studio_get_repair_status',
    'Get repair history and active plans for a project',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const plans = db.prepare(
        'SELECT * FROM repair_plans WHERE project_id = ? ORDER BY created_at DESC'
      ).all(params.project_id);
      const receipts = db.prepare(
        'SELECT * FROM repair_receipts WHERE project_id = ? ORDER BY created_at DESC'
      ).all(params.project_id);
      const regressions = db.prepare(
        'SELECT * FROM repair_regressions WHERE project_id = ? ORDER BY created_at DESC'
      ).all(params.project_id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            plans_count: plans.length,
            receipts_count: receipts.length,
            regressions_count: regressions.length,
            plans,
            receipts,
            regressions,
          }, null, 2),
        }],
      };
    },
  );
}
