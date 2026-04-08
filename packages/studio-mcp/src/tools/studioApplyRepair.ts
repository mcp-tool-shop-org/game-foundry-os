import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { applyRepair } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioApplyRepair(server: McpServer): void {
  server.tool(
    'studio_apply_repair',
    'Execute a planned repair in dry_run or apply mode — validates plan fingerprint, produces receipts',
    {
      project_id: z.string().describe('Project ID'),
      plan_id: z.string().describe('Repair plan ID from plan_repair'),
      mode: z.enum(['dry_run', 'apply']).describe('Execution mode'),
      project_root: z.string().describe('Absolute path to project root'),
    },
    async (params) => {
      const db = getDb();
      try {
        const result = applyRepair(
          db,
          params.project_id,
          params.plan_id,
          params.mode,
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
