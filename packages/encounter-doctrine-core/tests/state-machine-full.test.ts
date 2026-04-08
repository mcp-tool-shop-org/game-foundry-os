import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import {
  ENCOUNTER_PRODUCTION_STATES,
  transitionEncounterState,
  getEncounterProductionState,
  getEncounterStateEvents,
} from '@mcptoolshop/encounter-doctrine-core';

let db: Database.Database;

function seedEncounter(id = 'enc1') {
  upsertEncounter(db, { id, project_id: 'test', chapter: 'ch1', label: `Enc ${id}`, grid_rows: 3, grid_cols: 8 });
  db.prepare("UPDATE encounters SET display_name = ?, encounter_type = 'standard' WHERE id = ?").run(`Enc ${id}`, id);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
});

describe('encounter state machine — full transition coverage', () => {
  it('draft → intent_defined', () => {
    seedEncounter();
    const result = transitionEncounterState(db, 'enc1', 'intent_defined', { toolName: 'define_intent' });
    expect(result.from_state).toBe('draft');
    expect(result.to_state).toBe('intent_defined');
    expect(getEncounterProductionState(db, 'enc1')).toBe('intent_defined');
    const events = getEncounterStateEvents(db, 'enc1');
    expect(events).toHaveLength(1);
    expect(events[0].from_state).toBe('draft');
    expect(events[0].to_state).toBe('intent_defined');
  });

  it('intent_defined → roster_defined', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    const result = transitionEncounterState(db, 'enc1', 'roster_defined');
    expect(result.from_state).toBe('intent_defined');
    expect(result.to_state).toBe('roster_defined');
    expect(getEncounterProductionState(db, 'enc1')).toBe('roster_defined');
  });

  it('roster_defined → formation_defined', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    const result = transitionEncounterState(db, 'enc1', 'formation_defined');
    expect(result.from_state).toBe('roster_defined');
    expect(result.to_state).toBe('formation_defined');
  });

  it('formation_defined → rules_defined', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    const result = transitionEncounterState(db, 'enc1', 'rules_defined');
    expect(result.from_state).toBe('formation_defined');
    expect(result.to_state).toBe('rules_defined');
  });

  it('rules_defined → validated_structural', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    const result = transitionEncounterState(db, 'enc1', 'validated_structural');
    expect(result.from_state).toBe('rules_defined');
    expect(result.to_state).toBe('validated_structural');
  });

  it('validated_structural → dependencies_resolved', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    transitionEncounterState(db, 'enc1', 'validated_structural');
    const result = transitionEncounterState(db, 'enc1', 'dependencies_resolved');
    expect(result.from_state).toBe('validated_structural');
    expect(result.to_state).toBe('dependencies_resolved');
  });

  it('dependencies_resolved → manifest_exported', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    transitionEncounterState(db, 'enc1', 'validated_structural');
    transitionEncounterState(db, 'enc1', 'dependencies_resolved');
    const result = transitionEncounterState(db, 'enc1', 'manifest_exported');
    expect(result.from_state).toBe('dependencies_resolved');
    expect(result.to_state).toBe('manifest_exported');
  });

  it('full 12-state lifecycle chain from draft to frozen', () => {
    seedEncounter();
    const transitions: Array<{ from: string; to: string }> = [];

    const states = ENCOUNTER_PRODUCTION_STATES;
    expect(states).toHaveLength(12);

    // Walk through every state transition
    // formation_defined allows skip to validated_structural, but we go through rules_defined
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    transitionEncounterState(db, 'enc1', 'validated_structural');
    transitionEncounterState(db, 'enc1', 'dependencies_resolved');
    transitionEncounterState(db, 'enc1', 'manifest_exported');
    transitionEncounterState(db, 'enc1', 'engine_synced');
    transitionEncounterState(db, 'enc1', 'runtime_verified');
    transitionEncounterState(db, 'enc1', 'proved');
    transitionEncounterState(db, 'enc1', 'frozen');

    expect(getEncounterProductionState(db, 'enc1')).toBe('frozen');

    const events = getEncounterStateEvents(db, 'enc1');
    expect(events).toHaveLength(11); // 11 transitions for 12 states
    expect(events[0].from_state).toBe('draft');
    expect(events[10].to_state).toBe('frozen');
  });
});
