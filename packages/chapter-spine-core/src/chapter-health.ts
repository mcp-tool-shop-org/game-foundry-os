import type Database from 'better-sqlite3';
import type {
  ChapterRow,
  ChapterHealthStatus,
  ChapterHealthSnapshotRow,
  EncounterRow,
  EncounterCoverageEntry,
  QualityDomain,
  QualityDomainState,
  ProofRunRow,
  PlaytestSessionRow,
  BattleSceneContractRow,
  CombatUILayerRow,
  BattleSceneSnapshotRow,
} from '@mcptoolshop/game-foundry-registry';
import {
  getChapter,
  listEncounters,
  getSceneContractByEncounter,
  getLayersByContract,
  getSnapshotsByContract,
  listPlaytestSessions,
  insertChapterHealthSnapshot,
} from '@mcptoolshop/game-foundry-registry';
import { runBattleSceneDiagnostics } from '@mcptoolshop/battle-scene-core';
import crypto from 'node:crypto';

/** Per-encounter coverage computation */
export function getEncounterCoverageMap(
  db: Database.Database,
  chapterId: string,
  projectId: string,
): EncounterCoverageEntry[] {
  const encounters = listEncounters(db, { project_id: projectId, chapter: chapterId });

  return encounters.map(enc => {
    // Encounter contract: exists and not draft
    const hasEncounterContract = enc.production_state !== 'draft';

    // Battle scene contract
    const sceneContract = getSceneContractByEncounter(db, enc.id);
    const hasBattleSceneContract = !!sceneContract;

    // Layers configured
    const hasLayers = sceneContract
      ? getLayersByContract(db, sceneContract.id).length >= 5
      : false;

    // Snapshots captured
    const hasSnapshots = sceneContract
      ? getSnapshotsByContract(db, sceneContract.id).length >= 5
      : false;

    // Proof pass — latest battle_scene proof (pass or partial both count)
    const latestProof = sceneContract ? db.prepare(
      "SELECT * FROM proof_runs WHERE scope_type = 'battle_scene' AND scope_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(sceneContract.id) as ProofRunRow | undefined : undefined;
    const hasProofPass = latestProof?.result === 'pass' || latestProof?.result === 'partial';

    // Playtest pass
    const sessions = listPlaytestSessions(db, enc.id);
    const completedSessions = sessions.filter(s => s.session_state === 'completed');
    const latestPlaytest = completedSessions[0];
    const hasPlaytestPass = latestPlaytest?.quality_verdict === 'pass';

    // Major findings count (from battle scene diagnostics for this encounter)
    let majorFindings = 0;
    let weakestDomain: string | null = null;

    if (!hasBattleSceneContract) majorFindings++;
    if (hasBattleSceneContract && !hasLayers) majorFindings++;
    if (latestProof?.result === 'fail') majorFindings += latestProof.blocking_failures;
    if (latestPlaytest?.quality_verdict === 'fail') majorFindings++;

    // Determine weakest domain for this encounter
    if (!hasProofPass && !hasBattleSceneContract) {
      weakestDomain = 'presentation_integrity';
    } else if (!hasEncounterContract) {
      weakestDomain = 'encounter_integrity';
    } else if (latestPlaytest?.quality_verdict === 'fail') {
      weakestDomain = 'presentation_integrity';
    }

    return {
      encounter_id: enc.id,
      label: enc.label,
      has_encounter_contract: hasEncounterContract,
      has_battle_scene_contract: hasBattleSceneContract,
      has_layers: hasLayers,
      has_snapshots: hasSnapshots,
      has_proof_pass: hasProofPass,
      has_playtest_pass: hasPlaytestPass,
      weakest_domain: weakestDomain,
      major_findings: majorFindings,
    };
  });
}

/** Derive chapter health status from encounter coverage */
function deriveHealthStatus(
  coverage: EncounterCoverageEntry[],
  chapter: ChapterRow,
): { status: ChapterHealthStatus; blockerSummary: string | null } {
  if (coverage.length === 0) {
    return { status: 'incomplete', blockerSummary: 'No encounters in chapter' };
  }

  // Check for incomplete items first (missing contracts/layers/snapshots)
  const incomplete = coverage.filter(e =>
    !e.has_battle_scene_contract || !e.has_layers || !e.has_snapshots,
  );
  if (incomplete.length > 0) {
    const worst = incomplete[0];
    return {
      status: 'incomplete',
      blockerSummary: `${worst.label} ${!worst.has_battle_scene_contract ? 'needs scene contract' : !worst.has_layers ? 'needs UI layers' : 'needs snapshots'}`,
    };
  }

  // Check for blocked (proof failures on encounters that have contracts)
  const blocked = coverage.filter(e => e.has_battle_scene_contract && !e.has_proof_pass);
  if (blocked.length > 0) {
    const worst = blocked[0];
    return {
      status: 'blocked',
      blockerSummary: `${worst.label} has failing proof`,
    };
  }

  // Check for playtest requirement
  if (chapter.required_playtest_pass) {
    const noPlaytest = coverage.filter(e => !e.has_playtest_pass);
    if (noPlaytest.length > 0) {
      return {
        status: 'incomplete',
        blockerSummary: `${noPlaytest[0].label} needs passing playtest`,
      };
    }
  }

  // Check for stale/drifted proofs
  const noProof = coverage.filter(e => !e.has_proof_pass);
  if (noProof.length > 0) {
    return {
      status: 'drifted',
      blockerSummary: `${noProof[0].label} has no passing proof`,
    };
  }

  return { status: 'ready', blockerSummary: null };
}

/** Find the weakest quality domain across all encounter findings */
function findWeakestDomain(coverage: EncounterCoverageEntry[]): string | null {
  const domainPriority: Record<string, number> = {
    playability_integrity: 0,
    runtime_integrity: 1,
    visual_integrity: 2,
    encounter_integrity: 3,
    presentation_integrity: 4,
    canon_integrity: 5,
    shipping_integrity: 6,
  };

  let weakest: string | null = null;
  let weakestPriority = Infinity;

  for (const entry of coverage) {
    if (entry.weakest_domain && (domainPriority[entry.weakest_domain] ?? 9) < weakestPriority) {
      weakest = entry.weakest_domain;
      weakestPriority = domainPriority[entry.weakest_domain] ?? 9;
    }
  }

  return weakest;
}

/**
 * Compute comprehensive chapter health across all quality domains.
 */
export interface ChapterHealthResult {
  chapter_id: string;
  project_id: string;
  overall_status: ChapterHealthStatus;
  weakest_domain: string | null;
  blocker_summary: string | null;
  encounter_coverage: EncounterCoverageEntry[];
  next_action: string | null;
  next_action_target: string | null;
  snapshot_id: string;
}

export function computeChapterHealth(
  db: Database.Database,
  chapterId: string,
): ChapterHealthResult {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const coverage = getEncounterCoverageMap(db, chapterId, chapter.project_id);
  const { status, blockerSummary } = deriveHealthStatus(coverage, chapter);
  const weakestDomain = findWeakestDomain(coverage);

  // Determine next action
  let nextAction: string | null = null;
  let nextActionTarget: string | null = null;

  if (coverage.length === 0) {
    nextAction = 'create_encounter';
    nextActionTarget = chapterId;
  } else {
    // Find the worst encounter and recommend its fix
    const worst = coverage.find(e => !e.has_battle_scene_contract)
      ?? coverage.find(e => !e.has_layers)
      ?? coverage.find(e => !e.has_proof_pass)
      ?? coverage.find(e => !e.has_playtest_pass && chapter.required_playtest_pass)
      ?? null;

    if (worst) {
      if (!worst.has_battle_scene_contract) {
        nextAction = 'battle_create_scene_contract';
      } else if (!worst.has_layers) {
        nextAction = 'battle_configure_layers';
      } else if (!worst.has_proof_pass) {
        nextAction = 'battle_run_scene_proof';
      } else if (!worst.has_playtest_pass) {
        nextAction = 'battle_start_playtest';
      }
      nextActionTarget = worst.encounter_id;
    }
  }

  if (status === 'ready') {
    nextAction = 'continue_production';
    nextActionTarget = null;
  }

  // Persist health snapshot
  const snapshotId = `chs_${crypto.randomUUID().slice(0, 12)}`;
  insertChapterHealthSnapshot(db, {
    id: snapshotId,
    chapter_id: chapterId,
    project_id: chapter.project_id,
    overall_status: status,
    weakest_domain: weakestDomain ?? undefined,
    blocker_summary: blockerSummary ?? undefined,
    encounter_coverage_json: JSON.stringify(coverage),
    next_action: nextAction ?? undefined,
    next_action_target: nextActionTarget ?? undefined,
  });

  return {
    chapter_id: chapterId,
    project_id: chapter.project_id,
    overall_status: status,
    weakest_domain: weakestDomain,
    blocker_summary: blockerSummary,
    encounter_coverage: coverage,
    next_action: nextAction,
    next_action_target: nextActionTarget,
    snapshot_id: snapshotId,
  };
}
