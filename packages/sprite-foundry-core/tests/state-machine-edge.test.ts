import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  PRODUCTION_STATES, canTransition, transitionState, getStateEvents,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

describe('state machine edge cases', () => {
  let db: Database.Database;
  const projectId = 'proj_sme';
  const charId = 'char_sme';
  const variantId = 'var_sme';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'SM Edge Project', '/tmp/sme');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'SM Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
  });

  it('PRODUCTION_STATES has exactly 11 entries', () => {
    expect(PRODUCTION_STATES).toHaveLength(11);
    expect(PRODUCTION_STATES[0]).toBe('draft');
    expect(PRODUCTION_STATES[10]).toBe('frozen');
  });

  it('every state except frozen has at least one allowed transition', () => {
    for (const state of PRODUCTION_STATES) {
      if (state === 'frozen') continue;
      const idx = PRODUCTION_STATES.indexOf(state);
      const nextState = PRODUCTION_STATES[idx + 1];
      expect(canTransition(state, nextState)).toBe(true);
    }
  });

  it('frozen has no forward transitions', () => {
    for (const state of PRODUCTION_STATES) {
      expect(canTransition('frozen', state)).toBe(false);
    }
  });

  it('transition with explicit projectId uses it instead of looking up', () => {
    const result = transitionState(db, variantId, 'concept_batch_started', {
      projectId: 'explicit_project_id',
      toolName: 'test',
    });

    expect(result.to_state).toBe('concept_batch_started');

    const events = getStateEvents(db, 'variant', variantId);
    expect(events).toHaveLength(1);
    expect(events[0].project_id).toBe('explicit_project_id');
  });

  it('transition writes payload_json when provided', () => {
    const payload = { batch_id: 'batch_123', reason: 'test payload' };
    transitionState(db, variantId, 'concept_batch_started', {
      toolName: 'test',
      payload,
    });

    const events = getStateEvents(db, 'variant', variantId);
    expect(events).toHaveLength(1);
    expect(events[0].payload_json).toBeDefined();
    const parsed = JSON.parse(events[0].payload_json!);
    expect(parsed.batch_id).toBe('batch_123');
    expect(parsed.reason).toBe('test payload');
  });
});
