import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getEncounter, getEncounterEnemies } from '@mcptoolshop/game-foundry-registry';
import { getDb } from '../server.js';

export interface GdscriptEnemy {
  name: string;
  hp: number;
  guard: number;
  speed: number;
  move: number;
  ai_role: string;
  engine: Record<string, unknown>;
  grid_pos: string;
  sprite_pack: string;
  sprite_variant: string;
}

export interface EncounterManifest {
  encounter_id: string;
  gdscript_array: GdscriptEnemy[];
}

export function registerExportManifest(server: McpServer): void {
  server.tool(
    'export_manifest',
    'Export encounter as JSON matching GDScript encounter_data format with Vector2i grid positions',
    { encounter_id: z.string().describe('Encounter ID to export') },
    async ({ encounter_id }) => {
      const db = getDb();
      const encounter = getEncounter(db, encounter_id);
      if (!encounter) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Encounter not found: ${encounter_id}` }) }],
          isError: true,
        };
      }

      const enemies = getEncounterEnemies(db, encounter_id);
      const manifest = buildManifest(encounter_id, enemies);
      return { content: [{ type: 'text' as const, text: JSON.stringify(manifest) }] };
    }
  );
}

export function buildManifest(
  encounterId: string,
  enemies: Array<{
    display_name: string;
    hp: number | null;
    guard: number | null;
    speed: number | null;
    move_range: number | null;
    ai_role: string | null;
    engine_data: string | null;
    grid_row: number;
    grid_col: number;
    sprite_pack: string;
    variant_id: string;
  }>
): EncounterManifest {
  const gdscriptArray: GdscriptEnemy[] = enemies.map((e) => ({
    name: e.display_name,
    hp: e.hp ?? 0,
    guard: e.guard ?? 0,
    speed: e.speed ?? 0,
    move: e.move_range ?? 0,
    ai_role: e.ai_role ?? 'none',
    engine: e.engine_data ? JSON.parse(e.engine_data) : {},
    grid_pos: `Vector2i(${e.grid_row}, ${e.grid_col})`,
    sprite_pack: e.sprite_pack,
    sprite_variant: e.variant_id,
  }));

  return {
    encounter_id: encounterId,
    gdscript_array: gdscriptArray,
  };
}
