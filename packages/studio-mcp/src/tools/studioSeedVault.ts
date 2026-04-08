import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { seedVault } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioSeedVault(server: McpServer): void {
  server.tool(
    'studio_seed_vault',
    'Seed canon vault with design documentation pages',
    {
      project_id: z.string().describe('Project ID'),
      vault_path: z.string().describe('Absolute path to canon vault root'),
      bootstrap_mode: z.enum(['blank', 'story_first', 'combat_first', 'import_existing']).default('combat_first'),
    },
    async (params) => {
      const db = getDb();
      const result = seedVault(db, params.project_id, params.vault_path, params.bootstrap_mode);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
