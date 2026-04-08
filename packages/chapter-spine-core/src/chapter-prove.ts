import type Database from 'better-sqlite3';
import type {
  FreezeReadinessResult,
} from '@mcptoolshop/game-foundry-registry';
import {
  getChapter,
  getSceneContractByEncounter,
  listEncounters,
} from '@mcptoolshop/game-foundry-registry';
import { runSceneProof } from '@mcptoolshop/battle-scene-core';
import type { SceneProofResult, SpriteMetrics } from '@mcptoolshop/battle-scene-core';
import { computeChapterHealth } from './chapter-health.js';
import type { ChapterHealthResult } from './chapter-health.js';
import { getChapterPlaytestStatus } from './chapter-playtest.js';
import type { ChapterPlaytestStatus } from './chapter-playtest.js';

/** Per-encounter scene proof result */
export interface EncounterSceneProofEntry {
  encounter_id: string;
  label: string;
  contract_id: string | null;
  proof_result: SceneProofResult | null;
}

/** Complete prove bundle result */
export interface ChapterProveResult {
  chapter_id: string;
  project_id: string;
  health: ChapterHealthResult;
  scene_proofs: EncounterSceneProofEntry[];
  playtest_status: ChapterPlaytestStatus;
  blocker_count: number;
  warning_count: number;
}

/**
 * One entrypoint that runs all required proofs for a chapter.
 *
 * Composes: health → scene proofs → playtest aggregation
 */
export function runChapterProveBundle(
  db: Database.Database,
  chapterId: string,
  spriteMetricsMap?: Record<string, SpriteMetrics[]>,
): ChapterProveResult {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  // 1. Compute chapter health (includes encounter coverage map)
  const health = computeChapterHealth(db, chapterId);

  // 2. Run scene proofs for each encounter that has a scene contract
  const encounters = listEncounters(db, { project_id: chapter.project_id, chapter: chapterId });
  const sceneProofs: EncounterSceneProofEntry[] = [];
  let totalBlockers = 0;
  let totalWarnings = 0;

  for (const enc of encounters) {
    const contract = getSceneContractByEncounter(db, enc.id);
    if (contract) {
      const metrics = spriteMetricsMap?.[enc.id];
      const proofResult = runSceneProof(db, contract.id, metrics);
      sceneProofs.push({
        encounter_id: enc.id,
        label: enc.label,
        contract_id: contract.id,
        proof_result: proofResult,
      });
      totalBlockers += proofResult.blocking_failures;
      totalWarnings += proofResult.warning_count;
    } else {
      sceneProofs.push({
        encounter_id: enc.id,
        label: enc.label,
        contract_id: null,
        proof_result: null,
      });
      totalBlockers++; // Missing contract counts as a blocker
    }
  }

  // 3. Playtest aggregation
  const playtestStatus = getChapterPlaytestStatus(db, chapterId);

  return {
    chapter_id: chapterId,
    project_id: chapter.project_id,
    health,
    scene_proofs: sceneProofs,
    playtest_status: playtestStatus,
    blocker_count: totalBlockers,
    warning_count: totalWarnings,
  };
}
