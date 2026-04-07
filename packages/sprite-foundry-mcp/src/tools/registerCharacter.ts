import type Database from 'better-sqlite3';
import { z } from 'zod';
import { upsertCharacter } from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerRegisterCharacter(server: McpServer, db: Database.Database): void {
  server.tool(
    'register_character',
    'Register or update a character in the production registry',
    {
      id: z.string().describe('Character ID (e.g. skeleton_warrior)'),
      project_id: z.string().describe('Project this character belongs to'),
      display_name: z.string().describe('Human-readable name'),
      role: z.string().optional().describe('Role: party, enemy, boss, npc, miniboss'),
      family: z.string().optional().describe('Character family grouping'),
      faction: z.string().optional().describe('Faction affiliation'),
      ai_role: z.string().optional().describe('AI combat role'),
      chapter_primary: z.string().optional().describe('Primary chapter appearance'),
    },
    async (args) => {
      const character = upsertCharacter(db, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(character, null, 2) }],
      };
    },
  );
}
