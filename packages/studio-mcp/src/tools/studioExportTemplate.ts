import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { getTemplate, listTemplates } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioExportTemplate(server: McpServer): void {
  server.tool(
    'studio_export_template',
    'Export template info as JSON — includes template metadata and associated policies',
    {
      template_key: z.string().describe('Template key to export'),
    },
    async (params) => {
      const db = getDb();
      const template = getTemplate(db, params.template_key);
      if (!template) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Template not found: ${params.template_key}` }) }],
        };
      }

      const policies = db.prepare(
        'SELECT * FROM template_policies WHERE template_id = ?'
      ).all(template.id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            template,
            policies,
            exported_at: new Date().toISOString(),
          }, null, 2),
        }],
      };
    },
  );
}
