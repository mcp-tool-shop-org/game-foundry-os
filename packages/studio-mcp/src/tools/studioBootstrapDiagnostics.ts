import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { runDiagnostics } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioBootstrapDiagnostics(server: McpServer): void {
  server.tool(
    'studio_bootstrap_diagnostics',
    'Run bootstrap diagnostics — checks directories, runtime files, canon vault, proof shell',
    {
      project_id: z.string().describe('Project ID'),
      target_path: z.string().describe('Absolute path to project root to diagnose'),
    },
    async (params) => {
      const db = getDb();
      const result = runDiagnostics(db, params.project_id, params.target_path);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
