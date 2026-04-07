import type Database from 'better-sqlite3';
import { z } from 'zod';
import { lockPick, registerArtifact, transitionState } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryLockConceptPick(server: McpServer, db: Database.Database): void {
  server.tool(
    'lock_concept_pick',
    'Lock the chosen concept candidate for a variant, transitions to concept_locked',
    {
      variant_id: z.string().describe('Variant ID'),
      candidate_index: z.number().int().optional().describe('Index of the chosen candidate'),
      candidate_name: z.string().optional().describe('Name/filename of the chosen candidate'),
      locked_path: z.string().describe('Path to the locked concept image'),
      notes: z.string().optional().describe('Notes about why this candidate was chosen'),
    },
    async (args) => {
      try {
        // Look up project_id
        const variant = db.prepare('SELECT character_id FROM variants WHERE id = ?').get(args.variant_id) as { character_id: string } | undefined;
        if (!variant) throw new Error(`Variant not found: ${args.variant_id}`);
        const char = db.prepare('SELECT project_id FROM characters WHERE id = ?').get(variant.character_id) as { project_id: string } | undefined;
        const projectId = char?.project_id ?? 'unknown';

        // Register concept_locked artifact
        const artifact = registerArtifact(db, {
          project_id: projectId,
          variant_id: args.variant_id,
          artifact_type: 'concept_locked',
          path: args.locked_path,
          is_canonical: true,
        });

        // Create locked pick
        const pick = lockPick(db, {
          variant_id: args.variant_id,
          pick_type: 'concept',
          candidate_index: args.candidate_index,
          candidate_name: args.candidate_name,
          locked_artifact_id: artifact.id,
          notes: args.notes,
        });

        // Transition state
        const transition = transitionState(db, args.variant_id, 'concept_locked', {
          toolName: 'lock_concept_pick',
          reason: args.candidate_name
            ? `Locked concept: ${args.candidate_name}`
            : `Locked concept candidate #${args.candidate_index}`,
          payload: { pick_id: pick.id, artifact_id: artifact.id },
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ pick, artifact, transition }, null, 2) }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
