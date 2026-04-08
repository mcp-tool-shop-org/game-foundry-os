import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  transitionState,
  lockPick,
  getNextStep,
  getCharacterTimeline,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

const DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

describe('query tools', () => {
  let db: Database.Database;
  const projectId = 'proj_query';
  const charId = 'char_query';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'Query Project', '/tmp/query');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Query Char' });
  });

  describe('get_next_step', () => {
    it('returns correct next action for draft variant', () => {
      upsertVariant(db, { id: 'var_draft', character_id: charId, variant_type: 'base' });
      const step = getNextStep(db, 'var_draft');
      expect(step.variant_id).toBe('var_draft');
      expect(step.production_state).toBe('draft');
      expect(step.next_action).toContain('concept batch');
      expect(step.missing_locks).toHaveLength(0);
      expect(step.blockers).toHaveLength(0);
    });

    it('returns missing directional locks for directional_batch_started', () => {
      upsertVariant(db, { id: 'var_dbs', character_id: charId, variant_type: 'base' });
      transitionState(db, 'var_dbs', 'concept_batch_started');
      transitionState(db, 'var_dbs', 'concept_candidates_recorded');
      transitionState(db, 'var_dbs', 'concept_locked');
      transitionState(db, 'var_dbs', 'directional_batch_started');

      // Lock 2 of 5
      lockPick(db, { variant_id: 'var_dbs', pick_type: 'directional', direction: 'front' });
      lockPick(db, { variant_id: 'var_dbs', pick_type: 'directional', direction: 'back' });

      const step = getNextStep(db, 'var_dbs');
      expect(step.production_state).toBe('directional_batch_started');
      expect(step.missing_locks).toHaveLength(3);
      expect(step.missing_locks).toContain('front_34');
      expect(step.missing_locks).toContain('side');
      expect(step.missing_locks).toContain('back_34');
    });
  });

  describe('get_character_timeline', () => {
    it('returns merged timeline across multiple variants', () => {
      upsertVariant(db, { id: 'var_a', character_id: charId, variant_type: 'base' });
      upsertVariant(db, { id: 'var_b', character_id: charId, variant_type: 'phase2' });

      transitionState(db, 'var_a', 'concept_batch_started', { toolName: 'start_concept_batch' });
      transitionState(db, 'var_b', 'concept_batch_started', { toolName: 'start_concept_batch' });

      const timeline = getCharacterTimeline(db, charId);
      expect(timeline.length).toBeGreaterThanOrEqual(2);

      const variantIds = new Set(timeline.map(e => e.detail.variant_id));
      expect(variantIds.has('var_a')).toBe(true);
      expect(variantIds.has('var_b')).toBe(true);
    });

    it('returns empty timeline for character with no events', () => {
      const timeline = getCharacterTimeline(db, charId);
      expect(timeline).toHaveLength(0);
    });
  });
});
