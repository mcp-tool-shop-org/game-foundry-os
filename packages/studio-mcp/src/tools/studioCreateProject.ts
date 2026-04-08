import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { upsertProject } from '@mcptoolshop/game-foundry-registry';
import { createBootstrap } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioCreateProject(server: McpServer): void {
  server.tool(
    'studio_create_project',
    'Create a new project in the registry with a bootstrap record',
    {
      project_id: z.string().describe('Unique project identifier'),
      display_name: z.string().describe('Human-readable project name'),
      root_path: z.string().describe('Absolute path to project root'),
      template_id: z.string().optional().describe('Template ID to use'),
      bootstrap_mode: z.enum(['blank', 'story_first', 'combat_first', 'import_existing']).default('combat_first').describe('Bootstrap mode'),
    },
    async (params) => {
      const db = getDb();
      const project = upsertProject(db, params.project_id, params.display_name, params.root_path);
      const bootstrap = createBootstrap(db, params.project_id, params.template_id ?? null, params.bootstrap_mode, params.root_path);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ project, bootstrap }, null, 2),
        }],
      };
    },
  );
}
