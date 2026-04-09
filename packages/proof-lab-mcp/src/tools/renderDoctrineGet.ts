import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getRenderDoctrine, getRenderDoctrineOrDefaults } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerRenderDoctrineGet(server: McpServer): void {
  server.tool(
    'render_doctrine_get',
    'Get the render doctrine for a project — returns stored doctrine or sensible defaults from the Blender Render Doctrine',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const stored = getRenderDoctrine(db, params.project_id);
      const resolved = getRenderDoctrineOrDefaults(db, params.project_id);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            has_explicit_doctrine: !!stored,
            doctrine: resolved,
          }, null, 2),
        }],
      };
    },
  );
}
