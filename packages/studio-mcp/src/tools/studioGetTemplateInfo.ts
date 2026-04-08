import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { getTemplate, listTemplates } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioGetTemplateInfo(server: McpServer): void {
  server.tool(
    'studio_get_template_info',
    'Get template details by key, or list all templates if no key provided',
    {
      template_key: z.string().optional().describe('Template key to look up (omit to list all)'),
    },
    async (params) => {
      const db = getDb();
      if (params.template_key) {
        const template = getTemplate(db, params.template_key);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(template ?? { error: 'not found' }, null, 2) }],
        };
      }
      const templates = listTemplates(db);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ templates }, null, 2) }],
      };
    },
  );
}
