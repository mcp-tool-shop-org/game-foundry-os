import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { getProject, getEncounter, getEncounterEnemies } from '@mcptoolshop/game-foundry-registry';

export interface SyncManifestResult {
  encounter_id: string;
  exported_path: string;
  enemy_count: number;
}

export function syncEncounterManifest(
  db: Database.Database,
  projectId: string,
  encounterId: string,
): SyncManifestResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const encounter = getEncounter(db, encounterId);
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const enemies = getEncounterEnemies(db, encounterId);

  const manifest = {
    encounter_id: encounterId,
    chapter: encounter.chapter,
    label: encounter.label,
    doctrine: encounter.doctrine,
    max_turns: encounter.max_turns,
    grid: { rows: encounter.grid_rows, cols: encounter.grid_cols },
    enemies: enemies.map(e => ({
      name: e.display_name,
      variant_id: e.variant_id,
      sprite_pack: e.sprite_pack,
      ai_role: e.ai_role || 'none',
      grid_pos: { row: e.grid_row, col: e.grid_col },
      hp: e.hp || 0,
      guard: e.guard || 0,
      speed: e.speed || 0,
      move: e.move_range || 0,
      engine_data: e.engine_data ? JSON.parse(e.engine_data) : {},
    })),
  };

  const outDir = path.join(project.root_path, 'assets', 'data', 'encounters');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${encounterId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));

  return {
    encounter_id: encounterId,
    exported_path: outPath,
    enemy_count: enemies.length,
  };
}

export function registerSyncEncounterManifests(server: McpServer, db: Database.Database): void {
  server.tool(
    'sync_encounter_manifests',
    'Export encounter data from registry into a JSON manifest file for engine consumption',
    {
      project_id: z.string(),
      encounter_id: z.string(),
    },
    async ({ project_id, encounter_id }) => {
      try {
        const result = syncEncounterManifest(db, project_id, encounter_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
