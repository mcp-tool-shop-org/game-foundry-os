import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { installThemeShell } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioInstallThemeShell(server: McpServer): void {
  server.tool(
    'studio_install_theme_shell',
    'Install theme shell (type system + font hierarchy + color tokens)',
    {
      project_id: z.string().describe('Project ID'),
      godot_root: z.string().describe('Absolute path to Godot project root'),
    },
    async (params) => {
      const db = getDb();
      const result = installThemeShell(db, params.project_id, params.godot_root);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
