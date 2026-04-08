import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { EncounterRow, EncounterEnemyRow, EncounterRuleRow } from '@mcptoolshop/game-foundry-registry';
import { upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import { attachRule, getUnits, getRules } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineClone(server: McpServer): void {
  server.tool(
    'doctrine_clone',
    'Clone an encounter (with units and rules) to a new ID',
    {
      source_encounter_id: z.string().describe('Source encounter ID to clone from'),
      new_encounter_id: z.string().describe('New encounter ID'),
      new_display_name: z.string().optional().describe('New display name (defaults to source name + " (clone)")'),
    },
    async (params) => {
      const db = getDb();

      const source = db.prepare('SELECT * FROM encounters WHERE id = ?')
        .get(params.source_encounter_id) as EncounterRow | undefined;
      if (!source) throw new Error(`Source encounter not found: ${params.source_encounter_id}`);

      const newLabel = params.new_display_name ?? `${source.label} (clone)`;

      // Create new encounter
      const newEncounter = upsertEncounter(db, {
        id: params.new_encounter_id,
        project_id: source.project_id,
        chapter: source.chapter,
        label: newLabel,
        doctrine: source.doctrine ?? undefined,
        max_turns: source.max_turns ?? undefined,
        description: source.description ?? undefined,
        grid_rows: source.grid_rows,
        grid_cols: source.grid_cols,
        route_nodes: source.route_nodes ? JSON.parse(source.route_nodes) : undefined,
      });

      // Update Phase 2 fields
      db.prepare(`
        UPDATE encounters SET
          display_name = ?,
          encounter_type = ?,
          route_tag = ?,
          intent_summary = ?,
          production_state = 'draft'
        WHERE id = ?
      `).run(
        params.new_display_name ?? source.display_name ?? newLabel,
        source.encounter_type,
        source.route_tag,
        source.intent_summary,
        params.new_encounter_id,
      );

      // Clone units
      const units = getUnits(db, params.source_encounter_id);
      for (const unit of units) {
        addEnemy(db, {
          encounter_id: params.new_encounter_id,
          display_name: unit.display_name,
          variant_id: unit.variant_id,
          sprite_pack: unit.sprite_pack,
          ai_role: unit.ai_role ?? undefined,
          grid_row: unit.grid_row,
          grid_col: unit.grid_col,
          hp: unit.hp ?? undefined,
          guard: unit.guard ?? undefined,
          speed: unit.speed ?? undefined,
          move_range: unit.move_range ?? undefined,
          engine_data: unit.engine_data ? JSON.parse(unit.engine_data) : undefined,
          sort_order: unit.sort_order,
        });
      }

      // Clone rules
      const rules = getRules(db, params.source_encounter_id);
      for (const rule of rules) {
        attachRule(db, {
          encounter_id: params.new_encounter_id,
          rule_type: rule.rule_type,
          rule_key: rule.rule_key,
          rule_payload_json: rule.rule_payload_json ?? undefined,
        });
      }

      const result = db.prepare('SELECT * FROM encounters WHERE id = ?').get(params.new_encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ encounter: result, units_cloned: units.length, rules_cloned: rules.length }) }] };
    }
  );
}
