import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { recordPlaytestFailures, completePlaytest, getLatestPlaytest } from '@mcptoolshop/battle-scene-core';
import { getPlaytestSession } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerBattleRecordPlaytestResult(server: McpServer): void {
  server.tool(
    'battle_record_playtest_result',
    'Record read failures and quality verdict',
    {
      session_id: z.string().describe('Playtest session ID'),
      failures_json: z.string().optional().describe('JSON array of ReadFailureEntry objects'),
      verdict: z.string().optional().describe('Quality verdict: pass, fail, or marginal'),
      notes: z.string().optional().describe('Freeform notes'),
    },
    async (params) => {
      const db = getDb();

      if (params.failures_json) {
        const failures = JSON.parse(params.failures_json);
        recordPlaytestFailures(db, params.session_id, failures);
      }

      if (params.verdict) {
        completePlaytest(db, params.session_id, params.verdict as 'pass' | 'fail' | 'marginal', params.notes);
      }

      const session = getPlaytestSession(db, params.session_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(session, null, 2) }] };
    },
  );
}
