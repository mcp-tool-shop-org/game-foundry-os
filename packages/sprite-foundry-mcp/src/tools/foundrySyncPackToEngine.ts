import type Database from 'better-sqlite3';
import { z } from 'zod';
import { registerArtifact, transitionState, getArtifacts } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import fs from 'node:fs';
import path from 'node:path';

/** 5-direction to 8-direction mapping (engine expects 8 dirs) */
const DIR_5_TO_8: Record<string, string[]> = {
  front: ['front'],
  front_34: ['front_34'],
  side: ['side_left', 'side_right'],
  back_34: ['back_34'],
  back: ['back'],
};

export function registerFoundrySyncPackToEngine(server: McpServer, db: Database.Database): void {
  server.tool(
    'sync_pack_to_engine',
    'Copy pack files to engine directory using 5-to-8 direction mapping, transitions to engine_synced',
    {
      variant_id: z.string().describe('Variant ID'),
      pack_name: z.string().describe('Pack name'),
      runtime_variant_name: z.string().describe('Runtime variant name'),
      target_dir: z.string().describe('Engine target directory'),
    },
    async (args) => {
      try {
        // Look up project_id
        const variant = db.prepare('SELECT character_id FROM variants WHERE id = ?').get(args.variant_id) as { character_id: string } | undefined;
        if (!variant) throw new Error(`Variant not found: ${args.variant_id}`);
        const char = db.prepare('SELECT project_id FROM characters WHERE id = ?').get(variant.character_id) as { project_id: string } | undefined;
        const projectId = char?.project_id ?? 'unknown';

        // Get pack_member artifacts
        const packMembers = getArtifacts(db, args.variant_id, 'pack_member');
        if (packMembers.length === 0) {
          throw new Error('No pack_member artifacts found. Run slice_pack first.');
        }

        // Ensure target directory exists
        const targetBase = path.join(args.target_dir, args.pack_name, args.runtime_variant_name);
        fs.mkdirSync(targetBase, { recursive: true });

        // Copy files with 5->8 dir mapping
        const copied: string[] = [];
        for (const member of packMembers) {
          const srcDir = member.direction ?? 'front';
          const engineDirs = DIR_5_TO_8[srcDir] ?? [srcDir];

          for (const engineDir of engineDirs) {
            const destDir = path.join(targetBase, engineDir);
            fs.mkdirSync(destDir, { recursive: true });
            const destFile = path.join(destDir, path.basename(member.path));

            if (fs.existsSync(member.path)) {
              fs.copyFileSync(member.path, destFile);
              copied.push(destFile);
            }
          }
        }

        // Register sync receipt artifact
        const receipt = registerArtifact(db, {
          project_id: projectId,
          variant_id: args.variant_id,
          artifact_type: 'sync_receipt',
          path: targetBase,
          is_canonical: true,
          metadata_json: JSON.stringify({
            pack_name: args.pack_name,
            runtime_variant_name: args.runtime_variant_name,
            target_dir: args.target_dir,
            files_copied: copied.length,
          }),
        });

        // Transition state
        const transition = transitionState(db, args.variant_id, 'engine_synced', {
          toolName: 'sync_pack_to_engine',
          reason: `Synced ${copied.length} files to ${targetBase}`,
          payload: { receipt_id: receipt.id, files_copied: copied.length },
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              receipt,
              files_copied: copied.length,
              target_base: targetBase,
              transition,
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
