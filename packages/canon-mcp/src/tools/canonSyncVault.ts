import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { syncVault } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonSyncVault(server: McpServer): void {
  server.tool(
    'canon_sync_vault',
    'Walk an Obsidian vault directory, parse frontmatter, and register/update canon pages',
    {
      project_id: z.string().describe('Project ID'),
      vault_root: z.string().describe('Absolute path to the Obsidian vault root directory'),
    },
    async (params) => {
      const db = getDb();
      const result = syncVault(db, params.project_id, params.vault_root);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
