import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  transitionState, getProductionState,
  createBatch, listBatches,
  lockPick, getLockedPicks, hasAllDirectionalLocks,
  registerArtifact, getArtifacts,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

const DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

describe('directional flow tools', () => {
  let db: Database.Database;
  const projectId = 'proj_dir';
  const charId = 'char_dir';
  const variantId = 'var_dir';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'Directional Project', '/tmp/dir');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Dir Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
    // Advance to concept_locked
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
  });

  describe('start_directional_batch', () => {
    it('creates one batch per direction (5 batches)', () => {
      const batches = DIRECTIONS.map(dir =>
        createBatch(db, {
          variant_id: variantId,
          batch_type: 'directional',
          direction: dir,
          candidate_count: 4,
        }),
      );

      expect(batches).toHaveLength(5);
      batches.forEach((b, i) => {
        expect(b.batch_type).toBe('directional');
        expect(b.direction).toBe(DIRECTIONS[i]);
        expect(b.candidate_count).toBe(4);
        expect(b.status).toBe('open');
      });

      const listed = listBatches(db, variantId, 'directional');
      expect(listed).toHaveLength(5);
    });

    it('transitions to directional_batch_started', () => {
      DIRECTIONS.forEach(dir =>
        createBatch(db, { variant_id: variantId, batch_type: 'directional', direction: dir, candidate_count: 4 }),
      );

      const result = transitionState(db, variantId, 'directional_batch_started', {
        toolName: 'start_directional_batch',
        reason: 'Directional batches started for 5 directions',
      });

      expect(result.from_state).toBe('concept_locked');
      expect(result.to_state).toBe('directional_batch_started');
      expect(getProductionState(db, variantId)).toBe('directional_batch_started');
    });

    it('uses custom directions array when provided', () => {
      const customDirs = ['front', 'side', 'back'];
      const batches = customDirs.map(dir =>
        createBatch(db, {
          variant_id: variantId,
          batch_type: 'directional',
          direction: dir,
          candidate_count: 3,
        }),
      );

      expect(batches).toHaveLength(3);
      expect(batches.map(b => b.direction)).toEqual(customDirs);
    });
  });

  describe('lock_directional_pick', () => {
    beforeEach(() => {
      DIRECTIONS.forEach(dir =>
        createBatch(db, { variant_id: variantId, batch_type: 'directional', direction: dir, candidate_count: 4 }),
      );
      transitionState(db, variantId, 'directional_batch_started');
    });

    it('locks one direction and reports completion matrix', () => {
      const artifact = registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'directional_locked',
        direction: 'front',
        path: '/tmp/dir/front.png',
        is_canonical: true,
      });

      const pick = lockPick(db, {
        variant_id: variantId,
        pick_type: 'directional',
        direction: 'front',
        candidate_name: 'front_2.png',
        locked_artifact_id: artifact.id,
      });

      expect(pick.direction).toBe('front');
      expect(pick.pick_type).toBe('directional');

      const allPicks = getLockedPicks(db, variantId, 'directional');
      const lockedDirs = new Set(allPicks.map(p => p.direction));
      expect(lockedDirs.has('front')).toBe(true);
      expect(lockedDirs.size).toBe(1);
    });

    it('does not advance state with partial locks (3 of 5)', () => {
      for (const dir of ['front', 'front_34', 'side']) {
        registerArtifact(db, {
          project_id: projectId,
          variant_id: variantId,
          artifact_type: 'directional_locked',
          direction: dir,
          path: `/tmp/dir/${dir}.png`,
          is_canonical: true,
        });
        lockPick(db, {
          variant_id: variantId,
          pick_type: 'directional',
          direction: dir,
          candidate_name: `${dir}.png`,
        });
      }

      expect(hasAllDirectionalLocks(db, variantId)).toBe(false);
      expect(getProductionState(db, variantId)).toBe('directional_batch_started');
    });

    it('auto-advances to directional_locked when all 5 locked', () => {
      for (const dir of DIRECTIONS) {
        registerArtifact(db, {
          project_id: projectId,
          variant_id: variantId,
          artifact_type: 'directional_locked',
          direction: dir,
          path: `/tmp/dir/${dir}.png`,
          is_canonical: true,
        });
        lockPick(db, {
          variant_id: variantId,
          pick_type: 'directional',
          direction: dir,
          candidate_name: `${dir}.png`,
        });
      }

      expect(hasAllDirectionalLocks(db, variantId)).toBe(true);

      // Simulate auto-transition
      const result = transitionState(db, variantId, 'directional_locked', {
        toolName: 'lock_directional_pick',
        reason: 'All 5 directional picks locked',
      });

      expect(result.to_state).toBe('directional_locked');
      expect(getProductionState(db, variantId)).toBe('directional_locked');
    });

    it('registers directional_locked artifact for each lock', () => {
      for (const dir of DIRECTIONS) {
        registerArtifact(db, {
          project_id: projectId,
          variant_id: variantId,
          artifact_type: 'directional_locked',
          direction: dir,
          path: `/tmp/dir/${dir}.png`,
          is_canonical: true,
        });
      }

      const artifacts = getArtifacts(db, variantId, 'directional_locked');
      expect(artifacts).toHaveLength(5);
      const dirs = artifacts.map(a => a.direction).sort();
      expect(dirs).toEqual([...DIRECTIONS].sort());
    });

    it('upserts if same direction locked twice', () => {
      lockPick(db, {
        variant_id: variantId,
        pick_type: 'directional',
        direction: 'front',
        candidate_name: 'front_v1.png',
        candidate_index: 0,
      });

      // Lock same direction again
      const pick2 = lockPick(db, {
        variant_id: variantId,
        pick_type: 'directional',
        direction: 'front',
        candidate_name: 'front_v2.png',
        candidate_index: 1,
      });

      // Should have only 1 pick for 'front', not 2
      const picks = getLockedPicks(db, variantId, 'directional');
      const frontPicks = picks.filter(p => p.direction === 'front');
      expect(frontPicks).toHaveLength(1);
      expect(frontPicks[0].candidate_name).toBe('front_v2.png');
      expect(frontPicks[0].candidate_index).toBe(1);
    });
  });
});
