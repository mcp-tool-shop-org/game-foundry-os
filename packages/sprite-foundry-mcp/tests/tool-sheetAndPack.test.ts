import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  transitionState, getProductionState,
  lockPick, hasAllDirectionalLocks,
  registerArtifact, getArtifacts,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

const DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

describe('sheet and pack tools', () => {
  let db: Database.Database;
  const projectId = 'proj_sp';
  const charId = 'char_sp';
  const variantId = 'var_sp';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'Sheet & Pack Project', '/tmp/sp');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'SP Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
    // Advance to directional_locked
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');
    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }
    transitionState(db, variantId, 'directional_locked');
  });

  describe('assemble_sheet', () => {
    it('registers sheet + preview + silhouette artifacts', () => {
      const sheet = registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'sheet',
        path: '/tmp/sheet.png',
        is_canonical: true,
      });
      const preview = registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'sheet_preview',
        path: '/tmp/preview.png',
        is_canonical: true,
      });
      const silhouette = registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'sheet_silhouette',
        path: '/tmp/silhouette.png',
        is_canonical: true,
      });

      expect(sheet.artifact_type).toBe('sheet');
      expect(preview.artifact_type).toBe('sheet_preview');
      expect(silhouette.artifact_type).toBe('sheet_silhouette');
      expect(sheet.is_canonical).toBe(1);
    });

    it('transitions to sheet_assembled', () => {
      registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'sheet', path: '/tmp/sheet.png', is_canonical: true });

      const result = transitionState(db, variantId, 'sheet_assembled', {
        toolName: 'assemble_sheet',
        reason: 'Sprite sheet assembled from locked directionals',
      });

      expect(result.from_state).toBe('directional_locked');
      expect(result.to_state).toBe('sheet_assembled');
      expect(getProductionState(db, variantId)).toBe('sheet_assembled');
    });

    it('rejects if not all directional locks exist', () => {
      // Create a fresh variant without directional locks
      upsertVariant(db, { id: 'var_no_locks', character_id: charId, variant_type: 'base' });
      transitionState(db, 'var_no_locks', 'concept_batch_started');
      transitionState(db, 'var_no_locks', 'concept_candidates_recorded');
      transitionState(db, 'var_no_locks', 'concept_locked');
      transitionState(db, 'var_no_locks', 'directional_batch_started');
      // Only lock 2 directions
      lockPick(db, { variant_id: 'var_no_locks', pick_type: 'directional', direction: 'front' });
      lockPick(db, { variant_id: 'var_no_locks', pick_type: 'directional', direction: 'back' });

      expect(hasAllDirectionalLocks(db, 'var_no_locks')).toBe(false);
    });
  });

  describe('slice_pack', () => {
    beforeEach(() => {
      registerArtifact(db, { project_id: projectId, variant_id: variantId, artifact_type: 'sheet', path: '/tmp/sheet.png', is_canonical: true });
      transitionState(db, variantId, 'sheet_assembled');
    });

    it('registers pack_member artifact for each direction file', () => {
      const files = DIRECTIONS.map(dir => ({
        direction: dir,
        path: `/tmp/pack/${dir}.png`,
      }));

      const artifacts = files.map(f =>
        registerArtifact(db, {
          project_id: projectId,
          variant_id: variantId,
          artifact_type: 'pack_member',
          direction: f.direction,
          path: f.path,
          is_canonical: true,
          metadata_json: JSON.stringify({ pack_name: 'skeleton_warrior', runtime_variant_name: 'base' }),
        }),
      );

      expect(artifacts).toHaveLength(5);
      const packMembers = getArtifacts(db, variantId, 'pack_member');
      expect(packMembers).toHaveLength(5);
    });

    it('transitions to pack_sliced', () => {
      const result = transitionState(db, variantId, 'pack_sliced', {
        toolName: 'slice_pack',
        reason: 'Pack sliced: 5 files for skeleton_warrior',
      });

      expect(result.from_state).toBe('sheet_assembled');
      expect(result.to_state).toBe('pack_sliced');
      expect(getProductionState(db, variantId)).toBe('pack_sliced');
    });

    it('with engine_sync=true, also transitions to engine_synced', () => {
      transitionState(db, variantId, 'pack_sliced', { toolName: 'slice_pack' });

      // Register sync receipt (as the tool does with engine_sync=true)
      registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'sync_receipt',
        path: '/tmp/engine/target',
        is_canonical: true,
        metadata_json: JSON.stringify({ pack_name: 'skeleton_warrior', target_dir: '/tmp/engine' }),
      });

      const syncResult = transitionState(db, variantId, 'engine_synced', {
        toolName: 'slice_pack',
        reason: 'Engine sync to /tmp/engine',
      });

      expect(syncResult.from_state).toBe('pack_sliced');
      expect(syncResult.to_state).toBe('engine_synced');
      expect(getProductionState(db, variantId)).toBe('engine_synced');
    });
  });
});
