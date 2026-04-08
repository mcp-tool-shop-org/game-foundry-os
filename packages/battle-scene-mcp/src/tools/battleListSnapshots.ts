import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listSnapshots } from '@mcptoolshop/battle-scene-core';
import { getDb } from '../server.js';

export function registerBattleListSnapshots(server: McpServer): void {
  server.tool(
    'battle_list_snapshots',
    'List all snapshots for a contract',
    {
      contract_id: z.string().describe('Contract ID'),
    },
    async (params) => {
      const db = getDb();
      const snapshots = listSnapshots(db, params.contract_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(snapshots, null, 2) }] };
    },
  );
}
