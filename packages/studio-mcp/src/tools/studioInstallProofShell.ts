import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { installProofShell } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioInstallProofShell(server: McpServer): void {
  server.tool(
    'studio_install_proof_shell',
    'Install proof shell — seeds default proof suites and freeze policies',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const result = installProofShell(db, params.project_id);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
