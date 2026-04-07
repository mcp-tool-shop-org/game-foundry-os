import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getCharacterStatus, getProject } from '@mcptoolshop/game-foundry-registry';
import type { CompletenessReport } from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkVariantCompleteness } from '../utils/completeness.js';

export function registerValidateCompleteness(server: McpServer, db: Database.Database): void {
  server.tool(
    'validate_completeness',
    'Check filesystem presence for each pipeline stage of a character and all its variants',
    {
      character_id: z.string().describe('Character ID to validate'),
    },
    async ({ character_id }) => {
      const status = getCharacterStatus(db, character_id);
      if (!status) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Character not found: ${character_id}` }) }],
          isError: true,
        };
      }

      const project = getProject(db, status.project_id);
      if (!project) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Project not found: ${status.project_id}` }) }],
          isError: true,
        };
      }

      const allChecks = status.variants.flatMap(v => checkVariantCompleteness(project.root_path, v));
      const passCount = allChecks.filter(c => c.pass).length;

      const report: CompletenessReport = {
        character_id,
        checks: allChecks,
        overall_pass: allChecks.every(c => c.pass),
        completeness_pct: allChecks.length > 0 ? Math.round((passCount / allChecks.length) * 100) : 0,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      };
    },
  );
}
