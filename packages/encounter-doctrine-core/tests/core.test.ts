import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
  upsertPack,
  upsertEncounter,
} from '@mcptoolshop/game-foundry-registry';
import {
  // State machine
  ENCOUNTER_PRODUCTION_STATES,
  canEncounterTransition,
  transitionEncounterState,
  getEncounterProductionState,
  getEncounterStateEvents,
  // Roster
  addUnit,
  moveUnit,
  removeUnit,
  getUnits,
  getUnitCount,
  // Rules
  attachRule,
  getRules,
  removeRule,
  // Validation
  validateStructural,
  validateDependencies,
  getValidationHistory,
  // Next step
  getEncounterNextStep,
  // Timeline
  getEncounterTimeline,
  getChapterMatrix,
} from '@mcptoolshop/encounter-doctrine-core';

let db: Database.Database;

function seedEncounter(id = 'enc1', chapter = 'ch1') {
  upsertEncounter(db, {
    id,
    project_id: 'test',
    chapter,
    label: `Encounter ${id}`,
    grid_rows: 3,
    grid_cols: 8,
  });
  // Set display_name and encounter_type (Phase 2 fields)
  db.prepare(`
    UPDATE encounters SET display_name = ?, encounter_type = 'standard' WHERE id = ?
  `).run(`Encounter ${id}`, id);
}

function seedVariantAndPack() {
  upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
  upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
  upsertPack(db, { id: 'pack1', project_id: 'test', pack_type: 'enemy', root_path: '/tmp/packs/pack1' });
}

function addTestUnit(encounterId = 'enc1', row = 0, col = 0, variantId = 'var1', sortOrder = 0) {
  return addUnit(db, {
    encounter_id: encounterId,
    display_name: `Unit at ${row},${col}`,
    variant_id: variantId,
    sprite_pack: 'pack1',
    team: 'enemy',
    grid_row: row,
    grid_col: col,
    sort_order: sortOrder,
  });
}

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
});

// ─── State Machine ────────────────────────────────────────

describe('encounter state machine', () => {
  beforeEach(() => seedEncounter());

  it('allows valid forward transition draft -> intent_defined', () => {
    const result = transitionEncounterState(db, 'enc1', 'intent_defined');
    expect(result.from_state).toBe('draft');
    expect(result.to_state).toBe('intent_defined');
    expect(result.encounter_id).toBe('enc1');
    expect(result.event_id).toBeGreaterThan(0);
  });

  it('rejects invalid transition draft -> manifest_exported', () => {
    expect(() => transitionEncounterState(db, 'enc1', 'manifest_exported'))
      .toThrow(/Invalid transition.*draft.*manifest_exported/);
  });

  it('writes state_events row on transition', () => {
    transitionEncounterState(db, 'enc1', 'intent_defined', {
      reason: 'test reason',
      toolName: 'test_tool',
    });
    const events = getEncounterStateEvents(db, 'enc1');
    expect(events).toHaveLength(1);
    expect(events[0].entity_type).toBe('encounter');
    expect(events[0].entity_id).toBe('enc1');
    expect(events[0].from_state).toBe('draft');
    expect(events[0].to_state).toBe('intent_defined');
    expect(events[0].reason).toBe('test reason');
    expect(events[0].tool_name).toBe('test_tool');
  });

  it('throws for nonexistent encounter', () => {
    expect(() => transitionEncounterState(db, 'nope', 'intent_defined'))
      .toThrow(/Encounter not found/);
  });

  it('getEncounterProductionState returns current state', () => {
    expect(getEncounterProductionState(db, 'enc1')).toBe('draft');
    transitionEncounterState(db, 'enc1', 'intent_defined');
    expect(getEncounterProductionState(db, 'enc1')).toBe('intent_defined');
  });

  it('ENCOUNTER_PRODUCTION_STATES has 12 states', () => {
    expect(ENCOUNTER_PRODUCTION_STATES).toHaveLength(12);
  });

  it('allows formation_defined -> validated_structural (skipping rules_defined)', () => {
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    const result = transitionEncounterState(db, 'enc1', 'validated_structural');
    expect(result.to_state).toBe('validated_structural');
  });
});

// ─── Roster ─────────────────────────────────────────────

describe('roster', () => {
  beforeEach(() => {
    seedEncounter();
    seedVariantAndPack();
  });

  it('adds unit with all fields', () => {
    const unit = addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Skeleton Warrior',
      variant_id: 'var1',
      sprite_pack: 'pack1',
      team: 'enemy',
      role_tag: 'tank',
      ai_role: 'defender',
      grid_row: 1,
      grid_col: 2,
      facing: 'south',
      spawn_group: 'wave1',
      engine_profile_json: '{"armor":5}',
      sort_order: 0,
    });
    expect(unit.display_name).toBe('Skeleton Warrior');
    expect(unit.team).toBe('enemy');
    expect(unit.role_tag).toBe('tank');
    expect(unit.facing).toBe('south');
    expect(unit.spawn_group).toBe('wave1');
    expect(unit.engine_profile_json).toBe('{"armor":5}');
  });

  it('moves unit to new position', () => {
    const unit = addTestUnit();
    const moved = moveUnit(db, unit.id, { grid_row: 2, grid_col: 5 });
    expect(moved.grid_row).toBe(2);
    expect(moved.grid_col).toBe(5);
  });

  it('removes unit', () => {
    const unit = addTestUnit();
    expect(getUnitCount(db, 'enc1')).toBe(1);
    removeUnit(db, unit.id);
    expect(getUnitCount(db, 'enc1')).toBe(0);
  });

  it('getUnits returns sorted by sort_order', () => {
    addTestUnit('enc1', 0, 0, 'var1', 2);
    addTestUnit('enc1', 1, 0, 'var1', 0);
    addTestUnit('enc1', 2, 0, 'var1', 1);
    const units = getUnits(db, 'enc1');
    expect(units).toHaveLength(3);
    expect(units[0].sort_order).toBe(0);
    expect(units[1].sort_order).toBe(1);
    expect(units[2].sort_order).toBe(2);
  });

  it('getUnitCount returns correct count', () => {
    expect(getUnitCount(db, 'enc1')).toBe(0);
    addTestUnit('enc1', 0, 0);
    addTestUnit('enc1', 1, 0);
    expect(getUnitCount(db, 'enc1')).toBe(2);
  });
});

// ─── Rules ────────────────────────────────────────────────

describe('rules', () => {
  beforeEach(() => seedEncounter());

  it('attaches a phase_transition rule', () => {
    const rule = attachRule(db, {
      encounter_id: 'enc1',
      rule_type: 'phase_transition',
      rule_key: 'boss_phase2',
      rule_payload_json: '{"hp_threshold":50,"phase2_variant_id":"var_boss_p2"}',
    });
    expect(rule.rule_type).toBe('phase_transition');
    expect(rule.rule_key).toBe('boss_phase2');
    expect(rule.rule_payload_json).toContain('hp_threshold');
  });

  it('getRules returns all rules for encounter', () => {
    attachRule(db, { encounter_id: 'enc1', rule_type: 'win_condition', rule_key: 'defeat_all' });
    attachRule(db, { encounter_id: 'enc1', rule_type: 'loss_condition', rule_key: 'party_wipe' });
    const rules = getRules(db, 'enc1');
    expect(rules).toHaveLength(2);
  });

  it('removeRule deletes the rule', () => {
    const rule = attachRule(db, { encounter_id: 'enc1', rule_type: 'special', rule_key: 'fog' });
    expect(getRules(db, 'enc1')).toHaveLength(1);
    removeRule(db, rule.id);
    expect(getRules(db, 'enc1')).toHaveLength(0);
  });
});

// ─── Structural Validation ────────────────────────────────

describe('structural validation', () => {
  beforeEach(() => {
    seedEncounter();
    seedVariantAndPack();
  });

  it('passes for valid encounter with units in bounds', () => {
    addTestUnit('enc1', 0, 0);
    addTestUnit('enc1', 1, 3);
    const report = validateStructural(db, 'enc1');
    expect(report.pass).toBe(true);
    expect(report.validation_type).toBe('structural');
  });

  it('fails for unit out of bounds', () => {
    addTestUnit('enc1', 10, 0); // row 10 > grid_rows=3
    const report = validateStructural(db, 'enc1');
    expect(report.pass).toBe(false);
    const issues = (report.details as any).issues as string[];
    expect(issues.some(i => i.includes('out of'))).toBe(true);
  });

  it('fails for empty roster', () => {
    const report = validateStructural(db, 'enc1');
    expect(report.pass).toBe(false);
    const issues = (report.details as any).issues as string[];
    expect(issues.some(i => i.includes('empty'))).toBe(true);
  });

  it('writes validation run history', () => {
    addTestUnit('enc1', 0, 0);
    validateStructural(db, 'enc1');
    const history = getValidationHistory(db, 'enc1');
    expect(history).toHaveLength(1);
    expect(history[0].validation_type).toBe('structural');
    expect(history[0].result).toBe('pass');
  });
});

// ─── Dependency Validation ────────────────────────────────

describe('dependency validation', () => {
  beforeEach(() => {
    seedEncounter();
    seedVariantAndPack();
  });

  it('passes when all variants and packs exist', () => {
    addTestUnit('enc1', 0, 0); // uses var1 + pack1 which exist
    const report = validateDependencies(db, 'enc1');
    expect(report.pass).toBe(true);
  });

  it('fails when variant is missing', () => {
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Ghost',
      variant_id: 'nonexistent_variant',
      sprite_pack: 'pack1',
      grid_row: 0,
      grid_col: 0,
    });
    const report = validateDependencies(db, 'enc1');
    expect(report.pass).toBe(false);
    expect((report.details as any).missing_variants).toContain('nonexistent_variant');
  });

  it('fails when pack is missing', () => {
    addUnit(db, {
      encounter_id: 'enc1',
      display_name: 'Ghost',
      variant_id: 'var1',
      sprite_pack: 'nonexistent_pack',
      grid_row: 0,
      grid_col: 0,
    });
    const report = validateDependencies(db, 'enc1');
    expect(report.pass).toBe(false);
    expect((report.details as any).missing_packs).toContain('nonexistent_pack');
  });
});

// ─── Next Step ────────────────────────────────────────────

describe('next-step', () => {
  beforeEach(() => {
    seedEncounter();
    seedVariantAndPack();
  });

  it('returns define_intent for draft encounter', () => {
    const step = getEncounterNextStep(db, 'enc1');
    expect(step.production_state).toBe('draft');
    expect(step.next_action).toBe('define_intent');
  });

  it('returns validate_structural for formation_defined', () => {
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    const step = getEncounterNextStep(db, 'enc1');
    expect(step.next_action).toContain('validate_structural');
  });

  it('returns export_manifest for dependencies_resolved', () => {
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'validated_structural');
    transitionEncounterState(db, 'enc1', 'dependencies_resolved');
    const step = getEncounterNextStep(db, 'enc1');
    expect(step.next_action).toBe('export_manifest');
  });
});

// ─── Timeline ─────────────────────────────────────────────

describe('timeline', () => {
  beforeEach(() => {
    seedEncounter();
    seedVariantAndPack();
  });

  it('returns chronological events', () => {
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    const timeline = getEncounterTimeline(db, 'enc1');
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline[0].type).toBe('state_change');
    // Should be chronological
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestamp >= timeline[i - 1].timestamp).toBe(true);
    }
  });

  it('includes validation runs', () => {
    addTestUnit('enc1', 0, 0);
    validateStructural(db, 'enc1');
    const timeline = getEncounterTimeline(db, 'enc1');
    const validations = timeline.filter(e => e.type === 'validation');
    expect(validations).toHaveLength(1);
    expect(validations[0].summary).toContain('structural');
  });
});

// ─── Chapter Matrix ───────────────────────────────────────

describe('chapter matrix', () => {
  it('returns all encounters for chapter with states', () => {
    seedEncounter('enc_a', 'ch1');
    seedEncounter('enc_b', 'ch1');
    seedEncounter('enc_c', 'ch2');

    const matrix = getChapterMatrix(db, 'test', 'ch1');
    expect(matrix).toHaveLength(2);
    expect(matrix[0].encounter_id).toBe('enc_a');
    expect(matrix[1].encounter_id).toBe('enc_b');
    expect(matrix[0].production_state).toBe('draft');
  });
});
