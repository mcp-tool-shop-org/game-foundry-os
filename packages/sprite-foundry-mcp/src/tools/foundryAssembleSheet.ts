import type Database from 'better-sqlite3';
import { z } from 'zod';
import { registerArtifact, transitionState, hasAllDirectionalLocks } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryAssembleSheet(server: McpServer, db: Database.Database): void {
  server.tool(
    'assemble_sheet',
    'Register an assembled sprite sheet from locked directionals, transitions to sheet_assembled',
    {
      variant_id: z.string().describe('Variant ID'),
      sheet_path: z.string().describe('Path to the assembled sprite sheet'),
      preview_path: z.string().optional().describe('Path to the sheet preview image'),
      silhouette_path: z.string().optional().describe('Path to the sheet silhouette image'),
      metadata_json: z.string().optional().describe('JSON string of sheet metadata'),
    },
    async (args) => {
      try {
        // Verify all directional locks exist
        if (!hasAllDirectionalLocks(db, args.variant_id)) {
          throw new Error('Cannot assemble sheet: not all 5 directional picks are locked');
        }

        // Look up project_id
        const variant = db.prepare('SELECT character_id FROM variants WHERE id = ?').get(args.variant_id) as { character_id: string } | undefined;
        if (!variant) throw new Error(`Variant not found: ${args.variant_id}`);
        const char = db.prepare('SELECT project_id FROM characters WHERE id = ?').get(variant.character_id) as { project_id: string } | undefined;
        const projectId = char?.project_id ?? 'unknown';

        // Register sheet artifact
        const sheetArtifact = registerArtifact(db, {
          project_id: projectId,
          variant_id: args.variant_id,
          artifact_type: 'sheet',
          path: args.sheet_path,
          is_canonical: true,
          metadata_json: args.metadata_json,
        });

        // Register preview if provided
        let previewArtifact = null;
        if (args.preview_path) {
          previewArtifact = registerArtifact(db, {
            project_id: projectId,
            variant_id: args.variant_id,
            artifact_type: 'sheet_preview',
            path: args.preview_path,
            is_canonical: true,
          });
        }

        // Register silhouette if provided
        let silhouetteArtifact = null;
        if (args.silhouette_path) {
          silhouetteArtifact = registerArtifact(db, {
            project_id: projectId,
            variant_id: args.variant_id,
            artifact_type: 'sheet_silhouette',
            path: args.silhouette_path,
            is_canonical: true,
          });
        }

        // Update variant sheet_path
        db.prepare("UPDATE variants SET sheet_path = ?, sheet_present = 1, updated_at = datetime('now') WHERE id = ?")
          .run(args.sheet_path, args.variant_id);

        // Transition state
        const transition = transitionState(db, args.variant_id, 'sheet_assembled', {
          toolName: 'assemble_sheet',
          reason: 'Sprite sheet assembled from locked directionals',
          payload: {
            sheet_artifact: sheetArtifact.id,
            preview_artifact: previewArtifact?.id ?? null,
            silhouette_artifact: silhouetteArtifact?.id ?? null,
          },
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              sheet: sheetArtifact,
              preview: previewArtifact,
              silhouette: silhouetteArtifact,
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
