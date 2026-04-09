import type Database from 'better-sqlite3';
import type { ChapterAuthoringDefaultsRow } from '@mcptoolshop/game-foundry-registry';
import {
  upsertAuthoringDefaults,
  getAuthoringDefaults,
  getChapter,
} from '@mcptoolshop/game-foundry-registry';

/** System-level fallback defaults when no chapter defaults are set */
const SYSTEM_DEFAULTS = {
  grid_rows: 3,
  grid_cols: 8,
  encounter_type: 'standard',
  max_turns: null as number | null,
  tile_size_px: 64,
  viewport_width: 1280,
  viewport_height: 720,
  require_scene_contract: true,
  require_ui_layers: true,
  require_proof_pass: true,
  require_playtest_pass: false,
  require_canon_link: false,
};

export interface SetDefaultsInput {
  chapter_id: string;
  project_id: string;
  default_grid_rows?: number;
  default_grid_cols?: number;
  default_encounter_type?: string;
  default_max_turns?: number | null;
  default_tile_size_px?: number;
  default_viewport_width?: number;
  default_viewport_height?: number;
  require_scene_contract?: boolean;
  require_ui_layers?: boolean;
  require_proof_pass?: boolean;
  require_playtest_pass?: boolean;
  require_canon_link?: boolean;
}

export interface ResolvedDefaults {
  grid_rows: number;
  grid_cols: number;
  encounter_type: string;
  max_turns: number | null;
  tile_size_px: number;
  viewport_width: number;
  viewport_height: number;
  require_scene_contract: boolean;
  require_ui_layers: boolean;
  require_proof_pass: boolean;
  require_playtest_pass: boolean;
  require_canon_link: boolean;
}

/**
 * Set authoring defaults for a chapter. Upserts — safe to call multiple times.
 * Emits a state_events entry for audit trail.
 */
export function setChapterDefaults(
  db: Database.Database,
  input: SetDefaultsInput,
): ChapterAuthoringDefaultsRow {
  const chapter = getChapter(db, input.chapter_id);
  if (!chapter) throw new Error(`Chapter not found: ${input.chapter_id}`);

  const result = upsertAuthoringDefaults(db, input);

  // Emit state event
  db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name)
    VALUES (?, 'chapter_defaults', ?, 'none', 'set', 'Authoring defaults configured', 'chapter_defaults')
  `).run(input.project_id, input.chapter_id);

  return result;
}

/**
 * Get the raw chapter defaults row, or undefined if none set.
 */
export function getChapterDefaults(
  db: Database.Database,
  chapterId: string,
): ChapterAuthoringDefaultsRow | undefined {
  return getAuthoringDefaults(db, chapterId);
}

/**
 * Resolve defaults for a chapter: explicit chapter defaults merged with system fallbacks.
 */
export function resolveDefaults(
  db: Database.Database,
  chapterId: string,
): ResolvedDefaults {
  const row = getAuthoringDefaults(db, chapterId);

  if (!row) {
    return { ...SYSTEM_DEFAULTS };
  }

  return {
    grid_rows: row.default_grid_rows,
    grid_cols: row.default_grid_cols,
    encounter_type: row.default_encounter_type,
    max_turns: row.default_max_turns,
    tile_size_px: row.default_tile_size_px,
    viewport_width: row.default_viewport_width,
    viewport_height: row.default_viewport_height,
    require_scene_contract: row.require_scene_contract === 1,
    require_ui_layers: row.require_ui_layers === 1,
    require_proof_pass: row.require_proof_pass === 1,
    require_playtest_pass: row.require_playtest_pass === 1,
    require_canon_link: row.require_canon_link === 1,
  };
}
