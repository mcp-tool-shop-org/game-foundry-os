import type Database from 'better-sqlite3';
import type {
  ChapterRow,
  QualityDomain,
} from '@mcptoolshop/game-foundry-registry';
import { getChapter } from '@mcptoolshop/game-foundry-registry';
import { computeChapterHealth } from './chapter-health.js';
import type { ChapterHealthResult } from './chapter-health.js';

/** Chapter-level next step result */
export interface ChapterNextStepResult {
  chapter_id: string;
  action: string;
  action_target: string | null;
  target_encounter: string | null;
  quality_domain: string | null;
  why_it_matters: string;
  priority: 'critical' | 'normal' | 'low';
  chapter_status: string;
}

const DOMAIN_WHY: Record<string, string> = {
  presentation_integrity: 'This encounter\'s battle scene is unreadable — players cannot understand combat',
  encounter_integrity: 'This encounter is structurally incomplete — combat cannot run',
  playability_integrity: 'The chapter cannot be verified as playable without proof coverage',
  runtime_integrity: 'The game cannot launch without runtime infrastructure',
  visual_integrity: 'Pixel-art rendering is broken or degraded',
  canon_integrity: 'Design documentation is disconnected from production',
  shipping_integrity: 'The game cannot be exported or distributed',
};

/**
 * Get the highest-value next move for a chapter.
 * Finds the worst encounter and recommends the most impactful fix.
 */
export function getChapterNextStep(
  db: Database.Database,
  chapterId: string,
): ChapterNextStepResult {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const health = computeChapterHealth(db, chapterId);

  if (health.overall_status === 'ready') {
    return {
      chapter_id: chapterId,
      action: 'continue_production',
      action_target: null,
      target_encounter: null,
      quality_domain: null,
      why_it_matters: 'Chapter is healthy and ready for content production or freeze',
      priority: 'low',
      chapter_status: 'ready',
    };
  }

  // Find the encounter-level action from health computation
  const action = health.next_action ?? 'review_chapter';
  const target = health.next_action_target;
  const domain = health.weakest_domain;
  const why = domain ? (DOMAIN_WHY[domain] ?? 'This domain needs attention') : health.blocker_summary ?? 'Chapter needs work';

  const priority = health.overall_status === 'blocked' ? 'critical' : 'normal';

  return {
    chapter_id: chapterId,
    action,
    action_target: target,
    target_encounter: target,
    quality_domain: domain,
    why_it_matters: why,
    priority,
    chapter_status: health.overall_status,
  };
}
