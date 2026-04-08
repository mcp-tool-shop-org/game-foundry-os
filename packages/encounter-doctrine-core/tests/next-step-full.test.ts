import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import {
  transitionEncounterState,
  addUnit,
  getEncounterNextStep,
} from '@mcptoolshop/encounter-doctrine-core';

let db: Database.Database;

function seedEncounter(id = 'enc1') {
  upsertEncounter(db, { id, project_id: 'test', chapter: 'ch1', label: `Battle ${id}`, grid_rows: 3, grid_cols: 8 });
  db.prepare("UPDATE encounters SET display_name = ?, encounter_type = 'standard' WHERE id = ?").run(`Battle ${id}`, id);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test', '/tmp/test');
});

describe('encounter next-step — all states', () => {
  it('draft → suggests define_intent', () => {
    seedEncounter();
    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('draft');
    expect(step.next_action).toBe('define_intent');
  });

  it('intent_defined → suggests add_units when roster empty', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');

    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('intent_defined');
    expect(step.next_action).toBe('add_units');
    expect(step.blockers).toContain('No units in roster');
  });

  it('roster_defined → suggests define_formation', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');

    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('roster_defined');
    expect(step.next_action).toBe('define_formation');
  });

  it('rules_defined → suggests validate_structural', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');

    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('rules_defined');
    expect(step.next_action).toBe('validate_structural');
  });

  it('validated_structural → suggests validate_dependencies', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    transitionEncounterState(db, 'enc1', 'validated_structural');

    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('validated_structural');
    expect(step.next_action).toBe('validate_dependencies');
  });

  it('dependencies_resolved → suggests export_manifest', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    transitionEncounterState(db, 'enc1', 'validated_structural');
    transitionEncounterState(db, 'enc1', 'dependencies_resolved');

    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('dependencies_resolved');
    expect(step.next_action).toBe('export_manifest');
  });

  it('manifest_exported → suggests sync_to_engine', () => {
    seedEncounter();
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    transitionEncounterState(db, 'enc1', 'validated_structural');
    transitionEncounterState(db, 'enc1', 'dependencies_resolved');
    transitionEncounterState(db, 'enc1', 'manifest_exported');

    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('manifest_exported');
    expect(step.next_action).toBe('sync_to_engine');
  });
});
