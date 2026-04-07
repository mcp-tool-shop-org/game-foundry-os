import type Database from 'better-sqlite3';
import { z } from 'zod';
import { lockPick, registerArtifact, transitionState, getLockedPicks, hasAllDirectionalLocks } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const REQUIRED_DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

export function registerFoundryLockDirectionalPick(server: McpServer, db: Database.Database): void {
  server.tool(
    'lock_directional_pick',
    'Lock a chosen directional candidate for one direction. Auto-transitions to directional_locked when all 5 are locked.',
    {
      variant_id: z.string().describe('Variant ID'),
      direction: z.string().describe('Direction being locked (front, front_34, side, back_34, back)'),
      candidate_index: z.number().int().optional().describe('Index of the chosen candidate'),
      candidate_name: z.string().optional().describe('Name/filename of the chosen candidate'),
      locked_path: z.string().describe('Path to the locked directional image'),
      notes: z.string().optional().describe('Notes about this pick'),
    },
    async (args) => {
      try {
        // Look up project_id
        const variant = db.prepare('SELECT character_id FROM variants WHERE id = ?').get(args.variant_id) as { character_id: string } | undefined;
        if (!variant) throw new Error(`Variant not found: ${args.variant_id}`);
        const char = db.prepare('SELECT project_id FROM characters WHERE id = ?').get(variant.character_id) as { project_id: string } | undefined;
        const projectId = char?.project_id ?? 'unknown';

        // Register directional_locked artifact
        const artifact = registerArtifact(db, {
          project_id: projectId,
          variant_id: args.variant_id,
          artifact_type: 'directional_locked',
          direction: args.direction,
          path: args.locked_path,
          is_canonical: true,
        });

        // Create locked pick
        const pick = lockPick(db, {
          variant_id: args.variant_id,
          pick_type: 'directional',
          direction: args.direction,
          candidate_index: args.candidate_index,
          candidate_name: args.candidate_name,
          locked_artifact_id: artifact.id,
          notes: args.notes,
        });

        // Build completion matrix
        const allPicks = getLockedPicks(db, args.variant_id, 'directional');
        const lockedDirs = new Set(allPicks.map(p => p.direction));
        const completionMatrix: Record<string, boolean> = {};
        for (const dir of REQUIRED_DIRECTIONS) {
          completionMatrix[dir] = lockedDirs.has(dir);
        }
        const missingDirs = REQUIRED_DIRECTIONS.filter(d => !lockedDirs.has(d));
        const allLocked = hasAllDirectionalLocks(db, args.variant_id);

        // Auto-transition if all 5 directions are locked
        let transition = null;
        if (allLocked) {
          transition = transitionState(db, args.variant_id, 'directional_locked', {
            toolName: 'lock_directional_pick',
            reason: 'All 5 directional picks locked',
          });
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              pick,
              artifact,
              completion_matrix: completionMatrix,
              missing_directions: missingDirs,
              all_locked: allLocked,
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
