import type Database from 'better-sqlite3';
import type {
  ChapterRow,
  ChapterProductionState,
  EncounterRow,
} from '@mcptoolshop/game-foundry-registry';
import {
  upsertChapter,
  getChapter,
  listChapters,
  updateChapterState,
  listEncounters,
} from '@mcptoolshop/game-foundry-registry';

/** Legal forward transitions for chapter production state */
const TRANSITIONS: Record<ChapterProductionState, ChapterProductionState[]> = {
  draft: ['encounters_ready'],
  encounters_ready: ['scenes_ready'],
  scenes_ready: ['proof_passed'],
  proof_passed: ['playtest_passed'],
  playtest_passed: ['frozen'],
  frozen: [],
};

/**
 * Create or register a chapter for a project.
 */
export function createChapter(
  db: Database.Database,
  projectId: string,
  chapterId: string,
  displayName: string,
  opts?: {
    sort_order?: number;
    intent_summary?: string;
    required_encounter_count?: number;
    required_playtest_pass?: boolean;
  },
): ChapterRow {
  return upsertChapter(db, {
    id: chapterId,
    project_id: projectId,
    display_name: displayName,
    sort_order: opts?.sort_order,
    intent_summary: opts?.intent_summary,
    required_encounter_count: opts?.required_encounter_count,
    required_playtest_pass: opts?.required_playtest_pass,
  });
}

/**
 * Get all encounters that belong to a chapter.
 */
export function getChapterEncounters(
  db: Database.Database,
  chapterId: string,
  projectId?: string,
): EncounterRow[] {
  if (projectId) {
    return listEncounters(db, { project_id: projectId, chapter: chapterId });
  }
  // If no projectId, get chapter's project first
  const chapter = getChapter(db, chapterId);
  if (!chapter) return [];
  return listEncounters(db, { project_id: chapter.project_id, chapter: chapterId });
}

/**
 * Transition the chapter's production state forward.
 */
export function transitionChapterState(
  db: Database.Database,
  chapterId: string,
  toState: ChapterProductionState,
  reason?: string,
): void {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const fromState = chapter.production_state as ChapterProductionState;
  const allowed = TRANSITIONS[fromState] ?? [];
  if (!allowed.includes(toState)) {
    throw new Error(`Cannot transition chapter from '${fromState}' to '${toState}'`);
  }

  updateChapterState(db, chapterId, toState);

  // Emit state event
  db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name)
    VALUES (?, 'chapter', ?, ?, ?, ?, 'chapter_contract')
  `).run(chapter.project_id, chapterId, fromState, toState, reason ?? null);
}

export { getChapter, listChapters } from '@mcptoolshop/game-foundry-registry';
