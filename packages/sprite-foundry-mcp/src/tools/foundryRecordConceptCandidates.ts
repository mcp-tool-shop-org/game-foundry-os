import type Database from 'better-sqlite3';
import { z } from 'zod';
import { registerArtifact, updateBatchStatus, transitionState } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryRecordConceptCandidates(server: McpServer, db: Database.Database): void {
  server.tool(
    'record_concept_candidates',
    'Record generated concept candidate images for a variant batch',
    {
      variant_id: z.string().describe('Variant ID'),
      batch_id: z.string().describe('Batch ID to record candidates for'),
      candidates: z.array(z.object({
        path: z.string().describe('File path to the candidate image'),
        content_hash: z.string().optional().describe('SHA-256 hash of the file'),
        width: z.number().int().optional().describe('Image width in pixels'),
        height: z.number().int().optional().describe('Image height in pixels'),
      })).describe('Array of candidate image records'),
    },
    async (args) => {
      try {
        // Look up project_id from variant -> character
        const variant = db.prepare('SELECT character_id FROM variants WHERE id = ?').get(args.variant_id) as { character_id: string } | undefined;
        if (!variant) throw new Error(`Variant not found: ${args.variant_id}`);
        const char = db.prepare('SELECT project_id FROM characters WHERE id = ?').get(variant.character_id) as { project_id: string } | undefined;
        const projectId = char?.project_id ?? 'unknown';

        // Register each candidate as an artifact
        const artifacts = args.candidates.map((c, i) =>
          registerArtifact(db, {
            project_id: projectId,
            variant_id: args.variant_id,
            artifact_type: 'concept_candidate',
            path: c.path,
            content_hash: c.content_hash,
            width: c.width,
            height: c.height,
            is_canonical: false,
            metadata_json: JSON.stringify({ candidate_index: i }),
          }),
        );

        // Update batch status
        updateBatchStatus(db, args.batch_id, 'recorded');

        // Transition state
        const transition = transitionState(db, args.variant_id, 'concept_candidates_recorded', {
          toolName: 'record_concept_candidates',
          reason: `${artifacts.length} concept candidates recorded`,
          payload: { batch_id: args.batch_id, count: artifacts.length },
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ artifacts_registered: artifacts.length, transition }, null, 2) }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
