import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { installRuntimeShell } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioInstallRuntimeShell(server: McpServer): void {
  server.tool(
    'studio_install_runtime_shell',
    'Install Godot runtime shell files (battle scene, HUD, sprite loader, encounter loader)',
    {
      project_id: z.string().describe('Project ID'),
      godot_root: z.string().describe('Absolute path to Godot project root'),
    },
    async (params) => {
      const db = getDb();
      const result = installRuntimeShell(db, params.project_id, params.godot_root);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
