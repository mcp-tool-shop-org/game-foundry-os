import type Database from 'better-sqlite3';
import { z } from 'zod';
import { registerArtifact } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryAttachPortraitSet(server: McpServer, db: Database.Database): void {
  server.tool(
    'attach_portrait_set',
    'Attach portrait images to a variant and update its portrait state',
    {
      variant_id: z.string().describe('Variant ID'),
      portraits: z.array(z.object({
        path: z.string().describe('Path to portrait image'),
        size: z.enum(['80x80', '28x28']).describe('Portrait size (80x80 for large, 28x28 for small)'),
      })).describe('Array of portrait images to attach'),
    },
    async (args) => {
      try {
        // Look up project_id
        const variant = db.prepare('SELECT character_id FROM variants WHERE id = ?').get(args.variant_id) as { character_id: string } | undefined;
        if (!variant) throw new Error(`Variant not found: ${args.variant_id}`);
        const char = db.prepare('SELECT project_id FROM characters WHERE id = ?').get(variant.character_id) as { project_id: string } | undefined;
        const projectId = char?.project_id ?? 'unknown';

        // Register portrait artifacts
        const artifacts = args.portraits.map(p => {
          const [w, h] = p.size.split('x').map(Number);
          return registerArtifact(db, {
            project_id: projectId,
            variant_id: args.variant_id,
            artifact_type: 'portrait',
            path: p.path,
            width: w,
            height: h,
            is_canonical: true,
            metadata_json: JSON.stringify({ size: p.size }),
          });
        });

        // Update variant portrait_state
        db.prepare("UPDATE variants SET portrait_state = 'attached', updated_at = datetime('now') WHERE id = ?")
          .run(args.variant_id);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              variant_id: args.variant_id,
              portraits_attached: artifacts.length,
              portrait_state: 'attached',
              artifacts: artifacts.map(a => ({ id: a.id, path: a.path, size: `${a.width}x${a.height}` })),
            }, null, 2),
          }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
