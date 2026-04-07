import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { upsertEncounter, clearEnemies, addEnemy, getEncounterEnemies } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

const EnemySchema = z.object({
  display_name: z.string(),
  variant_id: z.string(),
  sprite_pack: z.string(),
  ai_role: z.string().optional(),
  grid_row: z.number().int(),
  grid_col: z.number().int(),
  hp: z.number().int().optional(),
  guard: z.number().int().optional(),
  speed: z.number().int().optional(),
  move_range: z.number().int().optional(),
  engine_data: z.record(z.unknown()).optional(),
  sort_order: z.number().int().optional(),
});

export function registerRegisterEncounter(server: McpServer): void {
  server.tool(
    'register_encounter',
    'Create or update an encounter definition with its enemies (replaces existing enemies)',
    {
      id: z.string().describe('Unique encounter ID'),
      project_id: z.string().describe('Project this encounter belongs to'),
      chapter: z.string().describe('Chapter identifier'),
      label: z.string().describe('Human-readable label'),
      doctrine: z.string().optional().describe('Combat doctrine type'),
      max_turns: z.number().int().optional().describe('Turn limit'),
      description: z.string().optional().describe('Encounter description'),
      grid_rows: z.number().int().optional().describe('Grid row count (default 3)'),
      grid_cols: z.number().int().optional().describe('Grid column count (default 8)'),
      route_nodes: z.array(z.string()).optional().describe('Route node IDs'),
      enemies: z.array(EnemySchema).describe('Enemy definitions'),
    },
    async (params) => {
      const db = getDb();
      const encounter = upsertEncounter(db, {
        id: params.id,
        project_id: params.project_id,
        chapter: params.chapter,
        label: params.label,
        doctrine: params.doctrine,
        max_turns: params.max_turns,
        description: params.description,
        grid_rows: params.grid_rows,
        grid_cols: params.grid_cols,
        route_nodes: params.route_nodes,
      });

      // Replace all enemies
      clearEnemies(db, params.id);
      for (const [i, enemy] of params.enemies.entries()) {
        addEnemy(db, {
          encounter_id: params.id,
          display_name: enemy.display_name,
          variant_id: enemy.variant_id,
          sprite_pack: enemy.sprite_pack,
          ai_role: enemy.ai_role,
          grid_row: enemy.grid_row,
          grid_col: enemy.grid_col,
          hp: enemy.hp,
          guard: enemy.guard,
          speed: enemy.speed,
          move_range: enemy.move_range,
          engine_data: enemy.engine_data,
          sort_order: enemy.sort_order ?? i,
        });
      }

      const enemies = getEncounterEnemies(db, params.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ ...encounter, enemies }) }] };
    }
  );
}
