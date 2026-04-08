import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { addUnit, getUnitCount } from '@mcptoolshop/encounter-doctrine-core';
import { canEncounterTransition, transitionEncounterState, getEncounterProductionState } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineAddUnit(server: McpServer): void {
  server.tool(
    'doctrine_add_unit',
    'Add a unit to the encounter roster. Can advance state to roster_defined.',
    {
      encounter_id: z.string().describe('Encounter ID'),
      variant_id: z.string().describe('Variant ID for this unit'),
      sprite_pack: z.string().describe('Sprite pack ID'),
      display_name: z.string().describe('Display name for the unit'),
      team: z.string().default('enemy').describe('Team affiliation'),
      role_tag: z.string().optional().describe('Role tag (e.g. tank, dps, healer)'),
      row_index: z.number().int().describe('Grid row'),
      col_index: z.number().int().describe('Grid column'),
      ai_role: z.string().optional().describe('AI combat role'),
      engine_profile_json: z.string().optional().describe('Engine profile JSON string'),
      spawn_group: z.string().optional().describe('Spawn group identifier'),
      sort_order: z.number().int().optional().describe('Sort order'),
    },
    async (params) => {
      const db = getDb();

      const unit = addUnit(db, {
        encounter_id: params.encounter_id,
        display_name: params.display_name,
        variant_id: params.variant_id,
        sprite_pack: params.sprite_pack,
        team: params.team,
        role_tag: params.role_tag,
        ai_role: params.ai_role,
        grid_row: params.row_index,
        grid_col: params.col_index,
        engine_profile_json: params.engine_profile_json,
        spawn_group: params.spawn_group,
        sort_order: params.sort_order,
      });

      // Try to advance to roster_defined if in intent_defined
      let transition = null;
      const currentState = getEncounterProductionState(db, params.encounter_id);
      if (canEncounterTransition(currentState, 'roster_defined')) {
        transition = transitionEncounterState(db, params.encounter_id, 'roster_defined', {
          reason: 'Unit added to roster',
          toolName: 'doctrine_add_unit',
        });
      }

      const count = getUnitCount(db, params.encounter_id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ unit, unit_count: count, transition }) }] };
    }
  );
}
