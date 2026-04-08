import type Database from 'better-sqlite3';
import type { EncounterCoverageEntry } from '@mcptoolshop/game-foundry-registry';
import { getChapter } from '@mcptoolshop/game-foundry-registry';
import { computeChapterVerdict } from './chapter-verdict.js';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';
import { getEncounterCoverageMap } from './chapter-health.js';
import { getChapterPlaytestStatus } from './chapter-playtest.js';
import crypto from 'node:crypto';

/** Chapter handoff artifact */
export interface ChapterHandoffArtifact {
  chapter_id: string;
  display_name: string;
  verdict: string;
  verdict_reason: string;
  what_was_built: { encounter_count: number; scene_count: number; proof_count: number };
  what_passed: string[];
  what_failed: Array<{ encounter_id: string; label: string; reason: string }>;
  what_is_blocking: { encounter: string | null; domain: string | null; detail: string | null } | null;
  next_highest_value_move: { action: string | null; target: string | null; why: string };
  encounter_detail: EncounterCoverageEntry[];
  playtest_summary: { overall_verdict: string; total_read_failures: number };
  generated_at: string;
  artifact_id: string;
}

/**
 * Generate a chapter handoff artifact — a complete production report
 * strong enough that the next contributor can continue without archaeology.
 */
export function generateChapterHandoff(
  db: Database.Database,
  chapterId: string,
  spriteMetricsMap?: Record<string, SpriteMetrics[]>,
): ChapterHandoffArtifact {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const verdictResult = computeChapterVerdict(db, chapterId, spriteMetricsMap);
  const coverage = getEncounterCoverageMap(db, chapterId, chapter.project_id);
  const playtestStatus = getChapterPlaytestStatus(db, chapterId);

  const whatPassed = coverage.filter(e => e.has_proof_pass && e.has_battle_scene_contract).map(e => e.label);
  const whatFailed: Array<{ encounter_id: string; label: string; reason: string }> = [];

  for (const entry of coverage) {
    if (!entry.has_battle_scene_contract) {
      whatFailed.push({ encounter_id: entry.encounter_id, label: entry.label, reason: 'No scene contract' });
    } else if (!entry.has_layers) {
      whatFailed.push({ encounter_id: entry.encounter_id, label: entry.label, reason: 'UI layers not configured' });
    } else if (!entry.has_proof_pass) {
      whatFailed.push({ encounter_id: entry.encounter_id, label: entry.label, reason: 'Proof not passing' });
    } else if (!entry.has_playtest_pass && chapter.required_playtest_pass) {
      whatFailed.push({ encounter_id: entry.encounter_id, label: entry.label, reason: 'Playtest not passing' });
    }
  }

  const sceneCount = coverage.filter(e => e.has_battle_scene_contract).length;
  const proofCount = coverage.filter(e => e.has_proof_pass).length;

  const whatIsBlocking = verdictResult.blocking_encounter
    ? { encounter: verdictResult.blocking_encounter, domain: verdictResult.blocking_domain, detail: verdictResult.verdict_reason }
    : null;

  const artifactId = `cha_${crypto.randomUUID().slice(0, 12)}`;
  const generatedAt = new Date().toISOString();

  // Persist to handoff_artifacts table
  db.prepare(`
    INSERT INTO handoff_artifacts (id, project_id, scope_type, scope_id, artifact_type, content_hash, details_json)
    VALUES (?, ?, 'chapter', ?, 'chapter_build_report', ?, ?)
  `).run(
    artifactId, chapter.project_id, chapterId,
    crypto.createHash('sha256').update(verdictResult.verdict_reason).digest('hex').slice(0, 16),
    JSON.stringify({ verdict: verdictResult.verdict, encounter_count: coverage.length, passed: whatPassed.length, failed: whatFailed.length }),
  );

  return {
    chapter_id: chapterId,
    display_name: chapter.display_name,
    verdict: verdictResult.verdict,
    verdict_reason: verdictResult.verdict_reason,
    what_was_built: { encounter_count: coverage.length, scene_count: sceneCount, proof_count: proofCount },
    what_passed: whatPassed,
    what_failed: whatFailed,
    what_is_blocking: whatIsBlocking,
    next_highest_value_move: {
      action: verdictResult.next_action,
      target: verdictResult.next_action_target,
      why: verdictResult.verdict_reason,
    },
    encounter_detail: coverage,
    playtest_summary: { overall_verdict: playtestStatus.overall_verdict, total_read_failures: playtestStatus.total_read_failures },
    generated_at: generatedAt,
    artifact_id: artifactId,
  };
}
