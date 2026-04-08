import type Database from 'better-sqlite3';
import type { ChapterVerdict } from '@mcptoolshop/game-foundry-registry';
import { getChapter } from '@mcptoolshop/game-foundry-registry';
import { computeChapterVerdict } from './chapter-verdict.js';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';

/** Freeze calibration result */
export interface ChapterFreezeCalibration {
  chapter_id: string;
  can_freeze: boolean;
  freeze_risk: 'clear' | 'warning' | 'blocked';
  verdict: ChapterVerdict;
  blockers: string[];
  warnings: string[];
}

/**
 * Determine if a chapter is fit to freeze.
 *
 * - playable → can freeze (clear)
 * - drifted → can freeze with warning
 * - blocked/incomplete → cannot freeze
 */
export function getChapterFreezeCalibration(
  db: Database.Database,
  chapterId: string,
  spriteMetricsMap?: Record<string, SpriteMetrics[]>,
): ChapterFreezeCalibration {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const verdictResult = computeChapterVerdict(db, chapterId, spriteMetricsMap);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (verdictResult.verdict === 'playable') {
    return {
      chapter_id: chapterId,
      can_freeze: true,
      freeze_risk: 'clear',
      verdict: 'playable',
      blockers: [],
      warnings: [],
    };
  }

  if (verdictResult.verdict === 'drifted') {
    warnings.push(verdictResult.verdict_reason);
    return {
      chapter_id: chapterId,
      can_freeze: true,
      freeze_risk: 'warning',
      verdict: 'drifted',
      blockers: [],
      warnings,
    };
  }

  // blocked or incomplete
  blockers.push(verdictResult.verdict_reason);
  if (verdictResult.blocking_encounter) {
    blockers.push(`Blocking encounter: ${verdictResult.blocking_encounter}`);
  }
  if (verdictResult.blocking_domain) {
    blockers.push(`Blocking domain: ${verdictResult.blocking_domain}`);
  }

  return {
    chapter_id: chapterId,
    can_freeze: false,
    freeze_risk: 'blocked',
    verdict: verdictResult.verdict,
    blockers,
    warnings: [],
  };
}
