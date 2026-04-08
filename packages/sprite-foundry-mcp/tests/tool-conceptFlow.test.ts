import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  transitionState, getProductionState,
  createBatch, getBatch, listBatches, updateBatchStatus,
  registerArtifact, getArtifacts,
  lockPick, getLockedPicks,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

describe('concept flow tools', () => {
  let db: Database.Database;
  const projectId = 'proj_concept';
  const charId = 'char_concept';
  const variantId = 'var_concept';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'Concept Project', '/tmp/concept');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Concept Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
  });

  describe('start_concept_batch', () => {
    it('creates batch record with correct variant_id and batch_type', () => {
      const batch = createBatch(db, {
        variant_id: variantId,
        batch_type: 'concept',
        candidate_count: 4,
        source_model: 'sd-xl-turbo',
      });

      expect(batch.variant_id).toBe(variantId);
      expect(batch.batch_type).toBe('concept');
      expect(batch.candidate_count).toBe(4);
      expect(batch.source_model).toBe('sd-xl-turbo');
      expect(batch.status).toBe('open');

      const fetched = getBatch(db, batch.id);
      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(batch.id);
    });

    it('transitions variant from draft to concept_batch_started', () => {
      createBatch(db, { variant_id: variantId, batch_type: 'concept', candidate_count: 4 });
      const result = transitionState(db, variantId, 'concept_batch_started', {
        toolName: 'start_concept_batch',
        reason: 'Concept batch started with 4 candidates',
      });

      expect(result.from_state).toBe('draft');
      expect(result.to_state).toBe('concept_batch_started');
      expect(getProductionState(db, variantId)).toBe('concept_batch_started');
    });

    it('rejects if variant is not in draft state', () => {
      transitionState(db, variantId, 'concept_batch_started');
      transitionState(db, variantId, 'concept_candidates_recorded');

      // Attempting to transition to concept_batch_started from concept_candidates_recorded should throw
      expect(() =>
        transitionState(db, variantId, 'concept_batch_started'),
      ).toThrow(/Invalid transition/);
    });
  });

  describe('record_concept_candidates', () => {
    beforeEach(() => {
      createBatch(db, { variant_id: variantId, batch_type: 'concept', candidate_count: 3 });
      transitionState(db, variantId, 'concept_batch_started');
    });

    it('registers artifacts for each candidate file', () => {
      const candidates = ['/tmp/c0.png', '/tmp/c1.png', '/tmp/c2.png'];
      const artifacts = candidates.map((path, i) =>
        registerArtifact(db, {
          project_id: projectId,
          variant_id: variantId,
          artifact_type: 'concept_candidate',
          direction: `candidate_${i}`,
          path,
          is_canonical: false,
          metadata_json: JSON.stringify({ candidate_index: i }),
        }),
      );

      expect(artifacts).toHaveLength(3);
      artifacts.forEach(a => {
        expect(a.artifact_type).toBe('concept_candidate');
        expect(a.is_canonical).toBe(0);
      });
    });

    it('updates batch status to recorded', () => {
      // Use the batch created in beforeEach
      const batches = listBatches(db, variantId, 'concept');
      expect(batches.length).toBeGreaterThan(0);
      const batch = batches[0];
      updateBatchStatus(db, batch.id, 'recorded');
      const updated = getBatch(db, batch.id);
      expect(updated!.status).toBe('recorded');
    });

    it('transitions to concept_candidates_recorded', () => {
      const result = transitionState(db, variantId, 'concept_candidates_recorded', {
        toolName: 'record_concept_candidates',
        reason: '3 concept candidates recorded',
      });
      expect(result.from_state).toBe('concept_batch_started');
      expect(result.to_state).toBe('concept_candidates_recorded');
      expect(getProductionState(db, variantId)).toBe('concept_candidates_recorded');
    });
  });

  describe('lock_concept_pick', () => {
    beforeEach(() => {
      createBatch(db, { variant_id: variantId, batch_type: 'concept', candidate_count: 3 });
      transitionState(db, variantId, 'concept_batch_started');
      transitionState(db, variantId, 'concept_candidates_recorded');
    });

    it('creates locked pick + concept_locked artifact', () => {
      const artifact = registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'concept_locked',
        path: '/tmp/concept_locked.png',
        is_canonical: true,
      });

      const pick = lockPick(db, {
        variant_id: variantId,
        pick_type: 'concept',
        candidate_name: 'c1.png',
        candidate_index: 1,
        locked_artifact_id: artifact.id,
        notes: 'Best composition',
      });

      expect(pick.pick_type).toBe('concept');
      expect(pick.candidate_name).toBe('c1.png');
      expect(pick.candidate_index).toBe(1);
      expect(pick.locked_artifact_id).toBe(artifact.id);
      expect(artifact.is_canonical).toBe(1);
    });

    it('transitions to concept_locked', () => {
      registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'concept_locked',
        path: '/tmp/concept_locked.png',
        is_canonical: true,
      });

      const result = transitionState(db, variantId, 'concept_locked', {
        toolName: 'lock_concept_pick',
      });
      expect(result.from_state).toBe('concept_candidates_recorded');
      expect(result.to_state).toBe('concept_locked');
      expect(getProductionState(db, variantId)).toBe('concept_locked');
    });
  });
});
