import type Database from 'better-sqlite3';
import type {
  ChapterRow,
  ChapterHealthSnapshotRow,
  ChapterProductionState,
  ChapterHealthStatus,
} from '../types.js';

export interface CreateChapterInput {
  id: string;
  project_id: string;
  display_name: string;
  sort_order?: number;
  intent_summary?: string;
  required_encounter_count?: number;
  required_playtest_pass?: boolean;
}

export function upsertChapter(db: Database.Database, input: CreateChapterInput): ChapterRow {
  db.prepare(`
    INSERT INTO chapters (id, project_id, display_name, sort_order, intent_summary, required_encounter_count, required_playtest_pass)
    VALUES (@id, @project_id, @display_name, @sort_order, @intent_summary, @required_encounter_count, @required_playtest_pass)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      sort_order = excluded.sort_order,
      intent_summary = COALESCE(excluded.intent_summary, chapters.intent_summary),
      required_encounter_count = COALESCE(excluded.required_encounter_count, chapters.required_encounter_count),
      required_playtest_pass = excluded.required_playtest_pass,
      updated_at = datetime('now')
  `).run({
    id: input.id,
    project_id: input.project_id,
    display_name: input.display_name,
    sort_order: input.sort_order ?? 0,
    intent_summary: input.intent_summary ?? null,
    required_encounter_count: input.required_encounter_count ?? null,
    required_playtest_pass: input.required_playtest_pass ? 1 : 0,
  });

  return db.prepare('SELECT * FROM chapters WHERE id = ?').get(input.id) as ChapterRow;
}

export function getChapter(db: Database.Database, id: string): ChapterRow | undefined {
  return db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as ChapterRow | undefined;
}

export function listChapters(db: Database.Database, projectId: string): ChapterRow[] {
  return db.prepare('SELECT * FROM chapters WHERE project_id = ? ORDER BY sort_order, id')
    .all(projectId) as ChapterRow[];
}

export function updateChapterState(db: Database.Database, id: string, state: ChapterProductionState): void {
  db.prepare("UPDATE chapters SET production_state = ?, updated_at = datetime('now') WHERE id = ?")
    .run(state, id);
}

export function insertChapterHealthSnapshot(
  db: Database.Database,
  input: {
    id: string;
    chapter_id: string;
    project_id: string;
    overall_status: ChapterHealthStatus;
    weakest_domain?: string;
    blocker_summary?: string;
    encounter_coverage_json?: string;
    domain_scores_json?: string;
    next_action?: string;
    next_action_target?: string;
  },
): ChapterHealthSnapshotRow {
  db.prepare(`
    INSERT INTO chapter_health_snapshots (
      id, chapter_id, project_id, overall_status, weakest_domain, blocker_summary,
      encounter_coverage_json, domain_scores_json, next_action, next_action_target
    ) VALUES (
      @id, @chapter_id, @project_id, @overall_status, @weakest_domain, @blocker_summary,
      @encounter_coverage_json, @domain_scores_json, @next_action, @next_action_target
    )
  `).run({
    id: input.id,
    chapter_id: input.chapter_id,
    project_id: input.project_id,
    overall_status: input.overall_status,
    weakest_domain: input.weakest_domain ?? null,
    blocker_summary: input.blocker_summary ?? null,
    encounter_coverage_json: input.encounter_coverage_json ?? null,
    domain_scores_json: input.domain_scores_json ?? null,
    next_action: input.next_action ?? null,
    next_action_target: input.next_action_target ?? null,
  });

  return db.prepare('SELECT * FROM chapter_health_snapshots WHERE id = ?').get(input.id) as ChapterHealthSnapshotRow;
}

export function getLatestChapterHealth(db: Database.Database, chapterId: string): ChapterHealthSnapshotRow | undefined {
  return db.prepare('SELECT * FROM chapter_health_snapshots WHERE chapter_id = ? ORDER BY computed_at DESC LIMIT 1')
    .get(chapterId) as ChapterHealthSnapshotRow | undefined;
}
