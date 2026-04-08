import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { seedProjectRegistry } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioSeedRegistry(server: McpServer): void {
  server.tool(
    'studio_seed_registry',
    'Seed registry defaults (proof suites and freeze policies) for a project',
    {
      project_id: z.string().describe('Project ID'),
      template_key: z.string().default('godot-tactics-template').describe('Template key for defaults'),
    },
    async (params) => {
      const db = getDb();
      const result = seedProjectRegistry(db, params.project_id, params.template_key);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
