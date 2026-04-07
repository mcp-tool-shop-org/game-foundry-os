import type Database from 'better-sqlite3';
import { z } from 'zod';
import { registerArtifact, transitionState } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundrySlicePack(server: McpServer, db: Database.Database): void {
  server.tool(
    'slice_pack',
    'Register sliced pack files from a sprite sheet, transitions to pack_sliced (optionally engine_synced)',
    {
      variant_id: z.string().describe('Variant ID'),
      pack_name: z.string().describe('Pack name (e.g. skeleton_warrior)'),
      runtime_variant_name: z.string().describe('Runtime variant name (e.g. base)'),
      files: z.array(z.object({
        direction: z.string().describe('Direction label (front, front_34, side, back_34, back, etc.)'),
        path: z.string().describe('Path to the sliced sprite file'),
      })).describe('Array of sliced pack files per direction'),
      engine_sync: z.boolean().optional().describe('If true, also sync to engine and transition to engine_synced'),
      engine_target_dir: z.string().optional().describe('Engine target directory (required if engine_sync is true)'),
    },
    async (args) => {
      try {
        // Look up project_id
        const variant = db.prepare('SELECT character_id FROM variants WHERE id = ?').get(args.variant_id) as { character_id: string } | undefined;
        if (!variant) throw new Error(`Variant not found: ${args.variant_id}`);
        const char = db.prepare('SELECT project_id FROM characters WHERE id = ?').get(variant.character_id) as { project_id: string } | undefined;
        const projectId = char?.project_id ?? 'unknown';

        // Register pack_member artifact for each file
        const artifacts = args.files.map(f =>
          registerArtifact(db, {
            project_id: projectId,
            variant_id: args.variant_id,
            artifact_type: 'pack_member',
            direction: f.direction,
            path: f.path,
            is_canonical: true,
            metadata_json: JSON.stringify({ pack_name: args.pack_name, runtime_variant_name: args.runtime_variant_name }),
          }),
        );

        // Update variant pack info
        db.prepare("UPDATE variants SET pack_present = 1, canonical_pack_name = ?, runtime_variant_name = ?, updated_at = datetime('now') WHERE id = ?")
          .run(args.pack_name, args.runtime_variant_name, args.variant_id);

        // Transition to pack_sliced
        const transition = transitionState(db, args.variant_id, 'pack_sliced', {
          toolName: 'slice_pack',
          reason: `Pack sliced: ${args.files.length} files for ${args.pack_name}`,
          payload: { pack_name: args.pack_name, file_count: args.files.length },
        });

        let syncTransition = null;
        if (args.engine_sync && args.engine_target_dir) {
          // Register sync receipt
          registerArtifact(db, {
            project_id: projectId,
            variant_id: args.variant_id,
            artifact_type: 'sync_receipt',
            path: args.engine_target_dir,
            is_canonical: true,
            metadata_json: JSON.stringify({
              pack_name: args.pack_name,
              runtime_variant_name: args.runtime_variant_name,
              target_dir: args.engine_target_dir,
            }),
          });

          syncTransition = transitionState(db, args.variant_id, 'engine_synced', {
            toolName: 'slice_pack',
            reason: `Engine sync to ${args.engine_target_dir}`,
          });
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              pack_members: artifacts.length,
              transition,
              sync_transition: syncTransition,
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
