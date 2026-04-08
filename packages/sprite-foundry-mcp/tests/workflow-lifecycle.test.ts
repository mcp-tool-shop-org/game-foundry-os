import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  transitionState, getProductionState, getStateEvents, PRODUCTION_STATES,
  createBatch, updateBatchStatus,
  lockPick, hasAllDirectionalLocks,
  registerArtifact, getArtifacts,
  getNextStep,
  getVariantTimeline,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

const DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

describe('full variant lifecycle through core functions', () => {
  let db: Database.Database;
  const projectId = 'proj_lifecycle';
  const charId = 'char_lifecycle';
  const variantId = 'var_lifecycle';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'Lifecycle Project', '/tmp/lifecycle');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Lifecycle Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
  });

  it('creates variant in draft state', () => {
    const state = getProductionState(db, variantId);
    expect(state).toBe('draft');
  });

  it('starts concept batch -> state becomes concept_batch_started', () => {
    const batch = createBatch(db, {
      variant_id: variantId,
      batch_type: 'concept',
      candidate_count: 4,
      source_model: 'sd-xl',
    });
    expect(batch.batch_type).toBe('concept');
    expect(batch.candidate_count).toBe(4);

    transitionState(db, variantId, 'concept_batch_started', {
      toolName: 'start_concept_batch',
      payload: { batch_id: batch.id },
    });
    expect(getProductionState(db, variantId)).toBe('concept_batch_started');
  });

  it('records concept candidates -> state becomes concept_candidates_recorded', () => {
    createBatch(db, { variant_id: variantId, batch_type: 'concept', candidate_count: 3 });
    transitionState(db, variantId, 'concept_batch_started');

    for (let i = 0; i < 3; i++) {
      registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'concept_candidate',
        direction: `candidate_${i}`,
        path: `/tmp/concept_${i}.png`,
        is_canonical: false,
      });
    }

    transitionState(db, variantId, 'concept_candidates_recorded', {
      toolName: 'record_concept_candidates',
    });
    expect(getProductionState(db, variantId)).toBe('concept_candidates_recorded');
    expect(getArtifacts(db, variantId, 'concept_candidate')).toHaveLength(3);
  });

  it('locks concept pick -> state becomes concept_locked + artifact registered', () => {
    createBatch(db, { variant_id: variantId, batch_type: 'concept', candidate_count: 3 });
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');

    const artifact = registerArtifact(db, {
      project_id: projectId,
      variant_id: variantId,
      artifact_type: 'concept_locked',
      path: '/tmp/concept_locked.png',
      is_canonical: true,
    });

    lockPick(db, {
      variant_id: variantId,
      pick_type: 'concept',
      candidate_name: 'concept_2.png',
      candidate_index: 2,
      locked_artifact_id: artifact.id,
    });

    transitionState(db, variantId, 'concept_locked', { toolName: 'lock_concept_pick' });
    expect(getProductionState(db, variantId)).toBe('concept_locked');
  });

  it('starts directional batch -> creates 5 batch records, state becomes directional_batch_started', () => {
    // Advance to concept_locked
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');

    const batches = DIRECTIONS.map(dir =>
      createBatch(db, {
        variant_id: variantId,
        batch_type: 'directional',
        direction: dir,
        candidate_count: 4,
      }),
    );
    expect(batches).toHaveLength(5);
    expect(batches.every(b => b.batch_type === 'directional')).toBe(true);

    transitionState(db, variantId, 'directional_batch_started');
    expect(getProductionState(db, variantId)).toBe('directional_batch_started');
  });

  it('locking 4 of 5 directions does NOT advance state', () => {
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');

    for (const dir of DIRECTIONS.slice(0, 4)) {
      lockPick(db, {
        variant_id: variantId,
        pick_type: 'directional',
        direction: dir,
        candidate_name: `${dir}.png`,
      });
    }
    expect(hasAllDirectionalLocks(db, variantId)).toBe(false);
    // State should still be directional_batch_started
    expect(getProductionState(db, variantId)).toBe('directional_batch_started');
  });

  it('locking all 5 directions advances to directional_locked', () => {
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');

    for (const dir of DIRECTIONS) {
      lockPick(db, {
        variant_id: variantId,
        pick_type: 'directional',
        direction: dir,
        candidate_name: `${dir}.png`,
      });
    }
    expect(hasAllDirectionalLocks(db, variantId)).toBe(true);

    transitionState(db, variantId, 'directional_locked');
    expect(getProductionState(db, variantId)).toBe('directional_locked');
  });

  it('assembles sheet -> state becomes sheet_assembled + 3 artifacts registered', () => {
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');
    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }
    transitionState(db, variantId, 'directional_locked');

    registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'sheet', path: '/tmp/sheet.png', is_canonical: true });
    registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'sheet_preview', path: '/tmp/preview.png', is_canonical: true });
    registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'sheet_silhouette', path: '/tmp/silhouette.png', is_canonical: true });

    transitionState(db, variantId, 'sheet_assembled', { toolName: 'assemble_sheet' });
    expect(getProductionState(db, variantId)).toBe('sheet_assembled');
    expect(getArtifacts(db, variantId, 'sheet')).toHaveLength(1);
    expect(getArtifacts(db, variantId, 'sheet_preview')).toHaveLength(1);
    expect(getArtifacts(db, variantId, 'sheet_silhouette')).toHaveLength(1);
  });

  it('slices pack -> state becomes pack_sliced + 8 pack_member artifacts', () => {
    // Advance to sheet_assembled
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');
    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }
    transitionState(db, variantId, 'directional_locked');
    transitionState(db, variantId, 'sheet_assembled');

    // Register 8 pack_member artifacts (5->8 direction mapping)
    const engineDirs = ['front', 'front_34', 'side_left', 'side_right', 'back_34', 'back', 'front_left', 'front_right'];
    for (const dir of engineDirs) {
      registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'pack_member',
        direction: dir,
        path: `/tmp/pack/${dir}.png`,
        is_canonical: true,
      });
    }

    transitionState(db, variantId, 'pack_sliced', { toolName: 'slice_pack' });
    expect(getProductionState(db, variantId)).toBe('pack_sliced');
    expect(getArtifacts(db, variantId, 'pack_member')).toHaveLength(8);
  });

  it('syncs to engine -> state becomes engine_synced', () => {
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');
    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }
    transitionState(db, variantId, 'directional_locked');
    transitionState(db, variantId, 'sheet_assembled');
    transitionState(db, variantId, 'pack_sliced');

    registerArtifact(db, {
      project_id: projectId,
      variant_id: variantId,
      artifact_type: 'sync_receipt',
      path: '/tmp/engine/target',
      is_canonical: true,
    });

    transitionState(db, variantId, 'engine_synced', { toolName: 'sync_pack_to_engine' });
    expect(getProductionState(db, variantId)).toBe('engine_synced');
  });

  it('full lifecycle produces correct timeline with all event types', () => {
    // Walk the full lifecycle
    const batch = createBatch(db, { variant_id: variantId, batch_type: 'concept', candidate_count: 3 });
    transitionState(db, variantId, 'concept_batch_started');

    registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'concept_candidate', path: '/tmp/c0.png', is_canonical: false });
    updateBatchStatus(db, batch.id, 'recorded');
    transitionState(db, variantId, 'concept_candidates_recorded');

    const lockedArt = registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'concept_locked', path: '/tmp/locked.png', is_canonical: true });
    lockPick(db, { variant_id: variantId, pick_type: 'concept', candidate_name: 'c0.png', locked_artifact_id: lockedArt.id });
    transitionState(db, variantId, 'concept_locked');

    for (const dir of DIRECTIONS) {
      createBatch(db, { variant_id: variantId, batch_type: 'directional', direction: dir, candidate_count: 4 });
    }
    transitionState(db, variantId, 'directional_batch_started');

    for (const dir of DIRECTIONS) {
      registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'directional_locked', direction: dir, path: `/tmp/dir_${dir}.png`, is_canonical: true });
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir, candidate_name: `${dir}.png` });
    }
    transitionState(db, variantId, 'directional_locked');

    registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'sheet', path: '/tmp/sheet.png', is_canonical: true });
    transitionState(db, variantId, 'sheet_assembled');
    transitionState(db, variantId, 'pack_sliced');
    transitionState(db, variantId, 'engine_synced');

    const timeline = getVariantTimeline(db, variantId);
    expect(timeline.length).toBeGreaterThan(0);

    const types = new Set(timeline.map(e => e.type));
    expect(types.has('state_change')).toBe(true);
    expect(types.has('batch')).toBe(true);
    expect(types.has('pick')).toBe(true);
    expect(types.has('artifact')).toBe(true);
  });

  it('next_step returns correct action at each stage', () => {
    // draft
    let step = getNextStep(db, variantId);
    expect(step.next_action).toContain('concept batch');

    transitionState(db, variantId, 'concept_batch_started');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('concept candidates');

    transitionState(db, variantId, 'concept_candidates_recorded');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('concept pick');

    transitionState(db, variantId, 'concept_locked');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('directional batch');

    transitionState(db, variantId, 'directional_batch_started');
    step = getNextStep(db, variantId);
    expect(step.missing_locks.length).toBeGreaterThan(0);

    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }
    transitionState(db, variantId, 'directional_locked');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('sheet');

    transitionState(db, variantId, 'sheet_assembled');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('pack');

    transitionState(db, variantId, 'pack_sliced');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('engine');

    transitionState(db, variantId, 'engine_synced');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('portrait');

    transitionState(db, variantId, 'proved');
    step = getNextStep(db, variantId);
    expect(step.next_action).toContain('Freeze');
  });
});
