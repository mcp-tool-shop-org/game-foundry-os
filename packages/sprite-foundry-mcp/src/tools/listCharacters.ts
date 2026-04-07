import type Database from 'better-sqlite3';
import { z } from 'zod';
import { listCharacters } from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerListCharacters(server: McpServer, db: Database.Database): void {
  server.tool(
    'list_characters',
    'List characters with optional filters for project, family, role, or status',
    {
      project_id: z.string().optional().describe('Filter by project ID'),
      family: z.string().optional().describe('Filter by character family'),
      role: z.string().optional().describe('Filter by role (party, enemy, boss, npc, miniboss)'),
      status_filter: z.string().optional().describe('Filter by freeze_status'),
    },
    async (args) => {
      const characters = listCharacters(db, {
        project_id: args.project_id,
        family: args.family,
        role: args.role,
        status_filter: args.status_filter,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ count: characters.length, characters }, null, 2) }],
      };
    },
  );
}
