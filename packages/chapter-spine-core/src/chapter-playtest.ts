import type Database from 'better-sqlite3';
import type {
  PlaytestVerdict,
  PlaytestSessionRow,
} from '@mcptoolshop/game-foundry-registry';
import {
  getChapter,
  listEncounters,
  listPlaytestSessions,
} from '@mcptoolshop/game-foundry-registry';

/** Chapter-level playtest status */
export interface ChapterPlaytestStatus {
  chapter_id: string;
  total_encounters: number;
  tested_encounters: number;
  untested_encounters: string[];
  passing_encounters: string[];
  failing_encounters: string[];
  marginal_encounters: string[];
  overall_verdict: PlaytestVerdict | 'untested' | 'incomplete';
  total_read_failures: number;
}

/**
 * Aggregate playtest results across all encounters in a chapter.
 * Worst encounter verdict wins.
 */
export function getChapterPlaytestStatus(
  db: Database.Database,
  chapterId: string,
): ChapterPlaytestStatus {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const encounters = listEncounters(db, { project_id: chapter.project_id, chapter: chapterId });

  const untested: string[] = [];
  const passing: string[] = [];
  const failing: string[] = [];
  const marginal: string[] = [];
  let totalReadFailures = 0;

  for (const enc of encounters) {
    const sessions = listPlaytestSessions(db, enc.id);
    const completed = sessions.filter(s => s.session_state === 'completed');

    if (completed.length === 0) {
      untested.push(enc.id);
      continue;
    }

    const latest = completed[0];
    totalReadFailures += latest.read_failures;

    switch (latest.quality_verdict) {
      case 'pass':
        passing.push(enc.id);
        break;
      case 'fail':
        failing.push(enc.id);
        break;
      case 'marginal':
        marginal.push(enc.id);
        break;
      default:
        untested.push(enc.id);
    }
  }

  // Derive overall verdict — worst wins
  let overallVerdict: PlaytestVerdict | 'untested' | 'incomplete';
  if (encounters.length === 0) {
    overallVerdict = 'untested';
  } else if (failing.length > 0) {
    overallVerdict = 'fail';
  } else if (untested.length > 0) {
    overallVerdict = 'incomplete';
  } else if (marginal.length > 0) {
    overallVerdict = 'marginal';
  } else {
    overallVerdict = 'pass';
  }

  return {
    chapter_id: chapterId,
    total_encounters: encounters.length,
    tested_encounters: passing.length + failing.length + marginal.length,
    untested_encounters: untested,
    passing_encounters: passing,
    failing_encounters: failing,
    marginal_encounters: marginal,
    overall_verdict: overallVerdict,
    total_read_failures: totalReadFailures,
  };
}
