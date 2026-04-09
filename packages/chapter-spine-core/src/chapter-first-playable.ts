import type Database from 'better-sqlite3';
import type {
  ChapterFirstPlayableResult,
  FirstPlayableStep,
  FirstPlayableStepStatus,
} from '@mcptoolshop/game-foundry-registry';
import {
  getChapter,
  listEncounters,
  getEncounterEnemies,
  getSceneContractByEncounter,
  getLayersByContract,
  getAuthoringDefaults,
} from '@mcptoolshop/game-foundry-registry';

interface StepDefinition {
  label: string;
  description: string;
  check: (ctx: StepContext) => StepCheckResult;
}

interface StepContext {
  db: Database.Database;
  chapterId: string;
  projectId: string;
  requirePlaytest: boolean;
  encounters: Array<{ id: string; display_name: string | null; label: string; bounds_valid: number | null; formation_valid: number | null }>;
}

interface StepCheckResult {
  done: boolean;
  detail: string | null;
}

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    label: 'Chapter declared',
    description: 'Chapter exists in the registry',
    check: () => ({ done: true, detail: null }), // Always done if we got this far
  },
  {
    label: 'Encounters created',
    description: 'Required number of encounters registered',
    check: (ctx) => {
      const chapter = getChapter(ctx.db, ctx.chapterId)!;
      const required = chapter.required_encounter_count ?? 1;
      const done = ctx.encounters.length >= required;
      return {
        done,
        detail: done ? null : `${ctx.encounters.length}/${required} encounters created`,
      };
    },
  },
  {
    label: 'All encounters have roster',
    description: 'Every encounter has at least one unit',
    check: (ctx) => {
      if (ctx.encounters.length === 0) return { done: false, detail: 'No encounters' };
      const missing = ctx.encounters.filter(e => getEncounterEnemies(ctx.db, e.id).length === 0);
      return {
        done: missing.length === 0,
        detail: missing.length > 0
          ? `${missing.length} encounter(s) need units: ${missing.map(e => e.display_name || e.label).join(', ')}`
          : null,
      };
    },
  },
  {
    label: 'All encounters have scene contracts',
    description: 'Every encounter has a battle scene contract',
    check: (ctx) => {
      if (ctx.encounters.length === 0) return { done: false, detail: 'No encounters' };
      const missing = ctx.encounters.filter(e => !getSceneContractByEncounter(ctx.db, e.id));
      return {
        done: missing.length === 0,
        detail: missing.length > 0
          ? `${missing.length} encounter(s) need scene contracts: ${missing.map(e => e.display_name || e.label).join(', ')}`
          : null,
      };
    },
  },
  {
    label: 'All scene contracts have layers',
    description: 'Every scene contract has 5 UI layers configured',
    check: (ctx) => {
      if (ctx.encounters.length === 0) return { done: false, detail: 'No encounters' };
      const incomplete: string[] = [];
      for (const enc of ctx.encounters) {
        const contract = getSceneContractByEncounter(ctx.db, enc.id);
        if (!contract) { incomplete.push(enc.display_name || enc.label); continue; }
        const layers = getLayersByContract(ctx.db, contract.id);
        if (layers.length < 5) incomplete.push(enc.display_name || enc.label);
      }
      return {
        done: incomplete.length === 0,
        detail: incomplete.length > 0 ? `${incomplete.length} encounter(s) need layer configuration` : null,
      };
    },
  },
  {
    label: 'All encounters validated',
    description: 'Every encounter passes bounds and formation validation',
    check: (ctx) => {
      if (ctx.encounters.length === 0) return { done: false, detail: 'No encounters' };
      const failing = ctx.encounters.filter(e => e.bounds_valid !== 1 || e.formation_valid !== 1);
      return {
        done: failing.length === 0,
        detail: failing.length > 0
          ? `${failing.length} encounter(s) need structural validation`
          : null,
      };
    },
  },
  {
    label: 'All scene proofs pass',
    description: 'Latest battle scene proof passes for every encounter',
    check: (ctx) => {
      if (ctx.encounters.length === 0) return { done: false, detail: 'No encounters' };
      const failing: string[] = [];
      for (const enc of ctx.encounters) {
        const latestProof = ctx.db.prepare(
          "SELECT result FROM proof_runs WHERE scope_type = 'battle_scene' AND scope_id = ? ORDER BY created_at DESC LIMIT 1"
        ).get(enc.id) as { result: string } | undefined;
        if (!latestProof || latestProof.result !== 'pass') {
          failing.push(enc.display_name || enc.label);
        }
      }
      return {
        done: failing.length === 0,
        detail: failing.length > 0 ? `${failing.length} encounter(s) need passing scene proofs` : null,
      };
    },
  },
  {
    label: 'All playtests pass',
    description: 'Latest playtest passes for every encounter (if required)',
    check: (ctx) => {
      if (!ctx.requirePlaytest) return { done: true, detail: null };
      if (ctx.encounters.length === 0) return { done: false, detail: 'No encounters' };
      const failing: string[] = [];
      for (const enc of ctx.encounters) {
        const latestPlaytest = ctx.db.prepare(
          "SELECT quality_verdict FROM playtest_sessions WHERE encounter_id = ? AND session_state = 'completed' ORDER BY completed_at DESC LIMIT 1"
        ).get(enc.id) as { quality_verdict: string | null } | undefined;
        if (!latestPlaytest || latestPlaytest.quality_verdict !== 'pass') {
          failing.push(enc.display_name || enc.label);
        }
      }
      return {
        done: failing.length === 0,
        detail: failing.length > 0 ? `${failing.length} encounter(s) need passing playtests` : null,
      };
    },
  },
  {
    label: 'Chapter verdict: playable',
    description: 'Chapter verdict computed as playable',
    check: (ctx) => {
      const latest = ctx.db.prepare(
        "SELECT verdict FROM chapter_verdicts WHERE chapter_id = ? ORDER BY created_at DESC LIMIT 1"
      ).get(ctx.chapterId) as { verdict: string } | undefined;
      return {
        done: latest?.verdict === 'playable',
        detail: latest ? `Current verdict: ${latest.verdict}` : 'No verdict computed yet',
      };
    },
  },
];

const NEXT_ACTION_MAP: Record<number, string> = {
  0: 'Create the chapter',
  1: 'Add encounters to the chapter',
  2: 'Add units to encounters (doctrine_add_unit)',
  3: 'Create scene contracts (battle_create_scene_contract)',
  4: 'Configure UI layers (battle_configure_layers)',
  5: 'Validate encounters structurally (doctrine_validate_structural)',
  6: 'Run scene proofs (battle_run_scene_proof)',
  7: 'Run playtests (battle_start_playtest)',
  8: 'Compute chapter verdict (chapter_run_full_proof)',
};

/**
 * Compute the ordered path from current state to first-playable chapter.
 * Returns 9 steps, each with done/pending/blocked status based on actual DB state.
 */
export function computeFirstPlayablePath(
  db: Database.Database,
  chapterId: string,
): ChapterFirstPlayableResult {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const defaults = getAuthoringDefaults(db, chapterId);
  const requirePlaytest = defaults
    ? defaults.require_playtest_pass === 1
    : chapter.required_playtest_pass === 1;

  const encounters = listEncounters(db, { project_id: chapter.project_id, chapter: chapterId });

  const ctx: StepContext = {
    db,
    chapterId,
    projectId: chapter.project_id,
    requirePlaytest,
    encounters,
  };

  const steps: FirstPlayableStep[] = [];
  let allPriorDone = true;

  for (let i = 0; i < STEP_DEFINITIONS.length; i++) {
    const def = STEP_DEFINITIONS[i];
    const result = def.check(ctx);

    let status: FirstPlayableStepStatus;
    if (result.done) {
      status = 'done';
    } else if (allPriorDone) {
      status = 'pending';
    } else {
      status = 'blocked';
    }

    if (!result.done) allPriorDone = false;

    steps.push({
      step_index: i,
      label: def.label,
      description: def.description,
      status,
      detail: result.detail,
      blocked_by: status === 'blocked' ? steps.find(s => s.status !== 'done')?.label ?? null : null,
    });
  }

  const doneCount = steps.filter(s => s.status === 'done').length;
  const currentStep = steps.findIndex(s => s.status !== 'done');

  return {
    chapter_id: chapterId,
    project_id: chapter.project_id,
    overall_progress_pct: Math.round((doneCount / steps.length) * 100),
    steps,
    current_step: currentStep === -1 ? steps.length : currentStep,
    next_action: currentStep >= 0 ? NEXT_ACTION_MAP[currentStep] ?? null : null,
    is_playable: doneCount === steps.length,
  };
}
