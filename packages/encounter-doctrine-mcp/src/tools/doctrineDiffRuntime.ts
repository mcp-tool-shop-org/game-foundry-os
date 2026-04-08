import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { diffManifestVsRuntime } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineDiffRuntime(server: McpServer): void {
  server.tool(
    'doctrine_diff_runtime',
    'Compare canonical export hash vs runtime file hash. Reports match/mismatch/missing.',
    {
      encounter_id: z.string().describe('Encounter ID'),
      project_root: z.string().describe('Project root path'),
    },
    async (params) => {
      const db = getDb();
      const result = diffManifestVsRuntime(db, params.encounter_id, params.project_root);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );
}
