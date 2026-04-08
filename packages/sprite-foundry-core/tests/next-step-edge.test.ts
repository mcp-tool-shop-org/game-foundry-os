import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  transitionState,
  lockPick,
  registerArtifact, getArtifacts,
  getNextStep,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

const DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

describe('next-step edge cases', () => {
  let db: Database.Database;
  const projectId = 'proj_ns';
  const charId = 'char_ns';
  const variantId = 'var_ns';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'NextStep Project', '/tmp/ns');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'NS Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
  });

  it('sheet_assembled with no sheet artifact reports missing artifact', () => {
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');
    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }
    transitionState(db, variantId, 'directional_locked');
    transitionState(db, variantId, 'sheet_assembled');

    // No sheet artifact registered
    const step = getNextStep(db, variantId);
    expect(step.production_state).toBe('sheet_assembled');
    expect(step.missing_artifacts).toContain('sheet');
    expect(step.blockers.length).toBeGreaterThan(0);
  });

  it('pack_sliced with fewer than 8 pack_members reports count', () => {
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

    // Register only 3 pack_members (fewer than 8)
    for (let i = 0; i < 3; i++) {
      registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'pack_member',
        direction: DIRECTIONS[i],
        path: `/tmp/pack/${DIRECTIONS[i]}.png`,
        is_canonical: true,
      });
    }

    const step = getNextStep(db, variantId);
    expect(step.production_state).toBe('pack_sliced');
    expect(step.missing_artifacts.some(a => a.includes('3/8'))).toBe(true);
  });

  it('engine_synced with portrait_state=none suggests portrait attachment', () => {
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
    transitionState(db, variantId, 'engine_synced');

    const step = getNextStep(db, variantId);
    expect(step.production_state).toBe('engine_synced');
    expect(step.portrait_state).toBe('none');
    expect(step.next_action).toContain('portrait');
  });

  it('engine_synced with portrait_state=attached suggests proof', () => {
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
    transitionState(db, variantId, 'engine_synced');

    // Set portrait_state to attached
    db.prepare("UPDATE variants SET portrait_state = 'attached' WHERE id = ?").run(variantId);

    const step = getNextStep(db, variantId);
    expect(step.production_state).toBe('engine_synced');
    expect(step.portrait_state).toBe('attached');
    expect(step.next_action).toContain('proof');
  });

  it('directional_batch_started with all locks reports state inconsistency', () => {
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');

    // Lock all 5 directions but don't advance state
    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }

    const step = getNextStep(db, variantId);
    expect(step.production_state).toBe('directional_batch_started');
    expect(step.missing_locks).toHaveLength(0);
    expect(step.blockers.length).toBeGreaterThan(0);
    expect(step.blockers[0]).toContain('directional_locked');
  });
});
