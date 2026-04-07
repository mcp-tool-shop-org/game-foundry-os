import type Database from 'better-sqlite3';
import { z } from 'zod';
import { upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import { transitionState, getProductionState } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryCreateVariant(server: McpServer, db: Database.Database): void {
  server.tool(
    'create_variant',
    'Create a new character variant (auto-creates character if needed), initializes it in draft state',
    {
      project_id: z.string().describe('Project ID'),
      character_id: z.string().describe('Parent character ID'),
      variant_id: z.string().describe('Unique variant ID (e.g. skeleton_warrior_base)'),
      variant_type: z.enum(['base', 'phase2', 'portrait', 'alt']).describe('Variant type'),
      display_name: z.string().describe('Human-readable name for the variant'),
      runtime_variant_name: z.string().optional().describe('Engine runtime variant name'),
      canonical_pack_name: z.string().optional().describe('Canonical asset pack name'),
    },
    async (args) => {
      try {
        // Auto-create character if it doesn't exist
        const existing = db.prepare('SELECT id FROM characters WHERE id = ?').get(args.character_id) as { id: string } | undefined;
        if (!existing) {
          upsertCharacter(db, {
            id: args.character_id,
            project_id: args.project_id,
            display_name: args.display_name,
          });
        }

        // Create variant
        const variant = upsertVariant(db, {
          id: args.variant_id,
          character_id: args.character_id,
          variant_type: args.variant_type,
        });

        // Set optional fields via UPDATE (not in CreateVariantInput)
        const updates: string[] = [];
        const params: Record<string, unknown> = { id: args.variant_id };

        if (args.display_name) {
          updates.push('display_name = @display_name');
          params.display_name = args.display_name;
        }
        if (args.runtime_variant_name) {
          updates.push('runtime_variant_name = @runtime_variant_name');
          params.runtime_variant_name = args.runtime_variant_name;
        }
        if (args.canonical_pack_name) {
          updates.push('canonical_pack_name = @canonical_pack_name');
          params.canonical_pack_name = args.canonical_pack_name;
        }
        if (updates.length > 0) {
          updates.push("updated_at = datetime('now')");
          db.prepare(`UPDATE variants SET ${updates.join(', ')} WHERE id = @id`).run(params);
        }

        // Record state event for draft (variant starts as draft from schema default)
        const state = getProductionState(db, args.variant_id);
        const result = {
          variant,
          production_state: state,
          character_auto_created: !existing,
        };

        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
