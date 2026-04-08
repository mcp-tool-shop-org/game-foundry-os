import type Database from 'better-sqlite3';
import type {
  ChapterVerdict,
  ChapterVerdictRow,
} from '@mcptoolshop/game-foundry-registry';
import { getChapter } from '@mcptoolshop/game-foundry-registry';
import { runChapterProveBundle } from './chapter-prove.js';
import type { ChapterProveResult } from './chapter-prove.js';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';
import crypto from 'node:crypto';

/** Full verdict result */
export interface ChapterVerdictResult {
  verdict: ChapterVerdict;
  verdict_reason: string;
  blocking_encounter: string | null;
  blocking_domain: string | null;
  next_action: string | null;
  next_action_target: string | null;
  prove_bundle: ChapterProveResult;
  verdict_id: string;
}

/**
 * Compute a decisive verdict for a chapter build.
 *
 * Runs the full prove bundle, then derives one of:
 * - playable: all proofs pass + health ready + playtests pass (if required)
 * - blocked: any encounter has failed proof (blocking_failures > 0)
 * - incomplete: any encounter missing contracts/layers/snapshots
 * - drifted: proofs pass but health not fully ready (stale/drift)
 */
export function computeChapterVerdict(
  db: Database.Database,
  chapterId: string,
  spriteMetricsMap?: Record<string, SpriteMetrics[]>,
): ChapterVerdictResult {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const bundle = runChapterProveBundle(db, chapterId, spriteMetricsMap);
  const health = bundle.health;
  const coverage = health.encounter_coverage;

  let verdict: ChapterVerdict;
  let verdictReason: string;
  let blockingEncounter: string | null = null;
  let blockingDomain: string | null = null;

  if (coverage.length === 0) {
    verdict = 'incomplete';
    verdictReason = `${chapter.display_name} has no encounters`;
  } else {
    // Check for encounters missing scene contracts or layers (incomplete)
    const incomplete = coverage.find(e => !e.has_battle_scene_contract || !e.has_layers || !e.has_snapshots);
    if (incomplete) {
      verdict = 'incomplete';
      blockingEncounter = incomplete.encounter_id;
      blockingDomain = incomplete.weakest_domain;
      if (!incomplete.has_battle_scene_contract) {
        verdictReason = `${chapter.display_name} incomplete — ${incomplete.label} needs scene contract`;
      } else if (!incomplete.has_layers) {
        verdictReason = `${chapter.display_name} incomplete — ${incomplete.label} needs UI layers`;
      } else {
        verdictReason = `${chapter.display_name} incomplete — ${incomplete.label} needs snapshots`;
      }
    }
    // Check for scene proof failures (blocked)
    else {
      const failedProof = bundle.scene_proofs.find(p =>
        p.proof_result && p.proof_result.result === 'fail',
      );
      if (failedProof) {
        verdict = 'blocked';
        blockingEncounter = failedProof.encounter_id;
        // Find the specific failing assertion
        const failingAssertion = failedProof.proof_result!.assertions.find(a => a.status === 'fail');
        blockingDomain = 'presentation_integrity';
        verdictReason = `${chapter.display_name} blocked — ${failedProof.label}: ${failingAssertion?.key ?? 'proof failed'} (${failingAssertion?.message ?? ''})`;
      }
      // Check playtest requirement
      else if (chapter.required_playtest_pass && bundle.playtest_status.failing_encounters.length > 0) {
        const failEnc = bundle.playtest_status.failing_encounters[0];
        const failLabel = coverage.find(e => e.encounter_id === failEnc)?.label ?? failEnc;
        verdict = 'blocked';
        blockingEncounter = failEnc;
        blockingDomain = 'presentation_integrity';
        verdictReason = `${chapter.display_name} blocked — ${failLabel} playtest failed`;
      }
      // Check for missing playtests when required
      else if (chapter.required_playtest_pass && bundle.playtest_status.untested_encounters.length > 0) {
        const untested = bundle.playtest_status.untested_encounters[0];
        const untestedLabel = coverage.find(e => e.encounter_id === untested)?.label ?? untested;
        verdict = 'incomplete';
        blockingEncounter = untested;
        verdictReason = `${chapter.display_name} incomplete — ${untestedLabel} needs playtest`;
      }
      // Check for drifted state (proofs pass but health not ready)
      else if (health.overall_status === 'drifted') {
        verdict = 'drifted';
        verdictReason = `${chapter.display_name} drifted — proofs pass but production state is stale`;
      }
      // All clear
      else {
        verdict = 'playable';
        const encCount = coverage.length;
        const proofCount = bundle.scene_proofs.filter(p => p.proof_result).length;
        verdictReason = `${chapter.display_name} is playable — ${encCount} encounter(s) pass proof${chapter.required_playtest_pass ? ' and playtest' : ''}`;
      }
    }
  }

  // Derive next action from health
  const nextAction = health.next_action;
  const nextActionTarget = health.next_action_target;

  // Persist verdict
  const verdictId = `cv_${crypto.randomUUID().slice(0, 12)}`;
  db.prepare(`
    INSERT INTO chapter_verdicts (
      id, chapter_id, project_id, verdict, verdict_reason,
      blocking_encounter, blocking_domain, prove_bundle_json,
      next_action, next_action_target
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    verdictId, chapterId, chapter.project_id,
    verdict, verdictReason,
    blockingEncounter, blockingDomain,
    JSON.stringify({ blocker_count: bundle.blocker_count, warning_count: bundle.warning_count }),
    nextAction, nextActionTarget,
  );

  return {
    verdict,
    verdict_reason: verdictReason,
    blocking_encounter: blockingEncounter,
    blocking_domain: blockingDomain,
    next_action: nextAction,
    next_action_target: nextActionTarget,
    prove_bundle: bundle,
    verdict_id: verdictId,
  };
}
