import type Database from 'better-sqlite3';
import { z } from 'zod';
import { upsertVariant } from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerRegisterVariant(server: McpServer, db: Database.Database): void {
  server.tool(
    'register_variant',
    'Register or update a character variant in the production registry',
    {
      id: z.string().describe('Variant ID (e.g. skeleton_warrior_base)'),
      character_id: z.string().describe('Parent character ID'),
      variant_type: z.enum(['base', 'phase2', 'portrait', 'alt']).describe('Variant type'),
      pack_id: z.string().optional().describe('Associated asset pack ID'),
      phase: z.number().optional().describe('Phase number for phase2 variants'),
      concept_dir: z.string().optional().describe('Override concept directory path'),
      directional_dir: z.string().optional().describe('Override directional directory path'),
      sheet_path: z.string().optional().describe('Override sheet path'),
      pack_dir: z.string().optional().describe('Override pack asset directory'),
    },
    async (args) => {
      const variant = upsertVariant(db, args);
      return {
        content: [{ type: 'text', text: JSON.stringify(variant, null, 2) }],
      };
    },
  );
}
