import type Database from 'better-sqlite3';
import { z } from 'zod';
import { setProductionState } from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerSetProductionState(server: McpServer, db: Database.Database): void {
  server.tool(
    'set_production_state',
    'Update a production pipeline state field for a character',
    {
      character_id: z.string().describe('Character ID'),
      field: z.enum([
        'concept_status', 'directional_status', 'sheet_status',
        'pack_status', 'portrait_status', 'integration_status', 'freeze_status',
      ]).describe('Production state field to update'),
      value: z.enum(['none', 'in_progress', 'complete', 'frozen']).describe('New state value'),
    },
    async ({ character_id, field, value }) => {
      try {
        const result = setProductionState(db, character_id, field, value);
        return {
          content: [{ type: 'text', text: JSON.stringify({ character_id, field, ...result }, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: (err as Error).message }) }],
          isError: true,
        };
      }
    },
  );
}
