import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { captureSnapshot } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleCaptureSnapshot(server: McpServer): void {
  server.tool(
    'battle_capture_snapshot',
    'Capture a canonical battle state snapshot',
    {
      contract_id: z.string().describe('Contract ID'),
      snapshot_key: z.enum(['neutral', 'threat_on', 'forecast', 'enemy_turn', 'pre_commit']).describe('Snapshot key'),
    },
    async (params) => {
      const db = getDb();
      const snapshot = captureSnapshot(db, params.contract_id, params.snapshot_key);
      return { content: [{ type: 'text' as const, text: JSON.stringify(snapshot, null, 2) }] };
    },
  );
}
