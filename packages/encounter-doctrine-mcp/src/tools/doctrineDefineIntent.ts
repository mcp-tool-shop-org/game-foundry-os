import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { transitionEncounterState } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineDefineIntent(server: McpServer): void {
  server.tool(
    'doctrine_define_intent',
    'Update intent_summary and transition encounter to intent_defined state',
    {
      encounter_id: z.string().describe('Encounter ID'),
      intent_summary: z.string().describe('Design intent summary'),
    },
    async (params) => {
      const db = getDb();

      db.prepare(`
        UPDATE encounters SET intent_summary = ?, updated_at = datetime('now') WHERE id = ?
      `).run(params.intent_summary, params.encounter_id);

      const transition = transitionEncounterState(db, params.encounter_id, 'intent_defined', {
        reason: 'Intent defined',
        toolName: 'doctrine_define_intent',
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify(transition) }] };
    }
  );
}
