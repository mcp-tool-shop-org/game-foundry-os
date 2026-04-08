import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { getAdoptionStage } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioGetAdoptionPlan(server: McpServer): void {
  server.tool(
    'studio_get_adoption_plan',
    'Returns adoption profile + staged plan for a project',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const row = db.prepare(
        'SELECT * FROM adoption_plans WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(params.project_id) as any;

      if (!row) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No adoption plan found — run import_existing_project first' }) }],
        };
      }

      const stageInfo = getAdoptionStage(db, params.project_id);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            plan_id: row.id,
            project_id: row.project_id,
            profile: row.profile,
            current_stage: row.current_stage,
            stages: JSON.parse(row.stages_json),
            completion: row.completion_json ? JSON.parse(row.completion_json) : null,
            current_stage_detail: stageInfo,
          }, null, 2),
        }],
      };
    },
  );
}
