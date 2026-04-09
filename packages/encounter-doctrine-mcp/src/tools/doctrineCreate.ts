import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export function registerDoctrineCreate(server: McpServer): void {
  server.tool(
    'doctrine_create',
    'Create or update an encounter with Phase 2 fields. Sets production_state to draft.',
    {
      project_id: z.string().describe('Project ID'),
      chapter_id: z.string().describe('Chapter identifier'),
      encounter_id: z.string().describe('Unique encounter ID'),
      display_name: z.string().describe('Human-readable display name'),
      encounter_type: z.enum(['standard', 'boss', 'miniboss', 'gauntlet']).default('standard').describe('Encounter type'),
      route_tag: z.string().optional().describe('Route tag for overworld placement'),
      intent_summary: z.string().optional().describe('Design intent summary'),
      arena_rows: z.number().int().optional().describe('Arena grid rows (default 3)'),
      arena_cols: z.number().int().optional().describe('Arena grid columns (default 8)'),
      turn_limit: z.number().int().optional().describe('Maximum turns'),
    },
    async (params) => {
      const db = getDb();

      // Check chapter authoring defaults for inheritance
      let inheritedRows = params.arena_rows;
      let inheritedCols = params.arena_cols;
      let inheritedTurnLimit = params.turn_limit;
      let inheritedType = params.encounter_type;

      const chapterDefaults = db.prepare(
        'SELECT * FROM chapter_authoring_defaults WHERE chapter_id = ?'
      ).get(params.chapter_id) as Record<string, unknown> | undefined;

      if (chapterDefaults) {
        if (inheritedRows === undefined) inheritedRows = chapterDefaults.default_grid_rows as number;
        if (inheritedCols === undefined) inheritedCols = chapterDefaults.default_grid_cols as number;
        if (inheritedTurnLimit === undefined && chapterDefaults.default_max_turns != null) {
          inheritedTurnLimit = chapterDefaults.default_max_turns as number;
        }
        // Only inherit encounter_type if the caller used the Zod default (i.e. didn't explicitly set it)
        // Since Zod .default('standard') always fills the value, we can't distinguish.
        // Instead, inherit encounter_type from defaults only if no explicit override from caller.
        // The Zod default means params.encounter_type is always set, so we skip type inheritance here.
        // Users who want chapter-level encounter_type should set it via chapter_set_defaults + chapter_scaffold.
      }

      // Upsert the encounter with base fields (inherited defaults fill unspecified fields)
      const encounter = upsertEncounter(db, {
        id: params.encounter_id,
        project_id: params.project_id,
        chapter: params.chapter_id,
        label: params.display_name,
        grid_rows: inheritedRows,
        grid_cols: inheritedCols,
        max_turns: inheritedTurnLimit,
      });

      // Update Phase 2 fields
      db.prepare(`
        UPDATE encounters SET
          display_name = ?,
          encounter_type = ?,
          route_tag = COALESCE(?, route_tag),
          intent_summary = COALESCE(?, intent_summary),
          production_state = 'draft',
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        params.display_name,
        params.encounter_type,
        params.route_tag ?? null,
        params.intent_summary ?? null,
        params.encounter_id,
      );

      const result = db.prepare('SELECT * FROM encounters WHERE id = ?').get(params.encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    }
  );
}
