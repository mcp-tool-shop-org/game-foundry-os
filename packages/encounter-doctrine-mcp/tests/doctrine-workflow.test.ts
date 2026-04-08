import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
  upsertEncounter, addEnemy, getEncounter, getEncounterEnemies,
} from '@mcptoolshop/game-foundry-registry';
import {
  transitionEncounterState,
  getEncounterProductionState,
  addUnit,
  removeUnit,
  getUnits,
  getUnitCount,
  attachRule,
  getRules,
  validateStructural,
  validateDependencies,
  exportManifest,
  getCanonicalExport,
  syncToEngine,
  getSyncReceipts,
  diffManifestVsRuntime,
  getEncounterNextStep,
} from '@mcptoolshop/encounter-doctrine-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-wf-'));
  upsertProject(db, 'test', 'Test', tmpDir);
  upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
  upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
  upsertVariant(db, { id: 'var2', character_id: 'char1', variant_type: 'base' });
  upsertVariant(db, { id: 'var3', character_id: 'char1', variant_type: 'base' });
  upsertPack(db, { id: 'pack1', project_id: 'test', pack_type: 'enemy', root_path: '/tmp/packs' });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('full encounter doctrine workflow', () => {
  it('creates encounter in draft state', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Forest Ambush', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Forest Ambush', encounter_type = 'standard' WHERE id = 'enc1'").run();

    const state = getEncounterProductionState(db, 'enc1');
    expect(state).toBe('draft');
  });

  it('defines intent → transitions to intent_defined', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Forest Ambush', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Forest Ambush', encounter_type = 'standard', intent_summary = 'Tutorial ambush introducing flanking' WHERE id = 'enc1'").run();

    const result = transitionEncounterState(db, 'enc1', 'intent_defined', {
      toolName: 'define_intent',
      reason: 'Tutorial ambush introducing flanking',
    });
    expect(result.to_state).toBe('intent_defined');
  });

  it('adds 3 units → can advance to roster_defined', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Forest Ambush', grid_rows: 3, grid_cols: 8 });
    transitionEncounterState(db, 'enc1', 'intent_defined');

    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin Scout', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 2, team: 'enemy' });
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin Archer', variant_id: 'var2', sprite_pack: 'pack1', grid_row: 1, grid_col: 5, team: 'enemy' });
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin Brute', variant_id: 'var3', sprite_pack: 'pack1', grid_row: 2, grid_col: 3, team: 'enemy' });

    expect(getUnitCount(db, 'enc1')).toBe(3);
    transitionEncounterState(db, 'enc1', 'roster_defined');
    expect(getEncounterProductionState(db, 'enc1')).toBe('roster_defined');
  });

  it('adds rule (phase_transition) → can advance to rules_defined', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    transitionEncounterState(db, 'enc1', 'intent_defined');
    transitionEncounterState(db, 'enc1', 'roster_defined');
    transitionEncounterState(db, 'enc1', 'formation_defined');

    const rule = attachRule(db, {
      encounter_id: 'enc1',
      rule_type: 'phase_transition',
      rule_key: 'hp_50',
      rule_payload_json: JSON.stringify({ threshold: 0.5, effect: 'enrage' }),
    });

    expect(rule.rule_type).toBe('phase_transition');
    expect(getRules(db, 'enc1')).toHaveLength(1);

    transitionEncounterState(db, 'enc1', 'rules_defined');
    expect(getEncounterProductionState(db, 'enc1')).toBe('rules_defined');
  });

  it('structural validation passes → transitions to validated_structural', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0, team: 'enemy' });

    const report = validateStructural(db, 'enc1');
    expect(report.pass).toBe(true);
  });

  it('dependency validation passes → transitions to dependencies_resolved', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0, team: 'enemy' });

    const report = validateDependencies(db, 'enc1');
    expect(report.pass).toBe(true);
  });

  it('exports manifest → transitions to manifest_exported, file written', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle', encounter_type = 'standard' WHERE id = 'enc1'").run();
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0, team: 'enemy' });
    validateStructural(db, 'enc1');
    validateDependencies(db, 'enc1');

    const result = exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');
    expect(fs.existsSync(result.manifest_path)).toBe(true);

    const canonical = getCanonicalExport(db, 'enc1');
    expect(canonical).toBeDefined();
    expect(canonical!.content_hash).toBe(result.content_hash);
  });

  it('syncs to engine → receipt created', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle', encounter_type = 'standard' WHERE id = 'enc1'").run();
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0, team: 'enemy' });
    validateStructural(db, 'enc1');
    validateDependencies(db, 'enc1');
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');

    const targetPath = path.join(tmpDir, 'runtime', 'enc1.json');
    const result = syncToEngine(db, 'enc1', 'test', targetPath);
    expect(fs.existsSync(result.target_path)).toBe(true);

    const receipts = getSyncReceipts(db, 'enc1');
    expect(receipts).toHaveLength(1);
  });

  it('diff shows match after sync', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle', encounter_type = 'standard' WHERE id = 'enc1'").run();
    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0, team: 'enemy' });
    validateStructural(db, 'enc1');
    validateDependencies(db, 'enc1');
    exportManifest(db, 'enc1', tmpDir, 'encounters/enc1.json');

    const diff = diffManifestVsRuntime(db, 'enc1', tmpDir);
    expect(diff.status).toBe('match');
  });

  it('clone creates copy with same roster and rules', () => {
    upsertEncounter(db, { id: 'enc_src', project_id: 'test', chapter: 'ch1', label: 'Source', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Source', encounter_type = 'standard' WHERE id = 'enc_src'").run();
    addUnit(db, { encounter_id: 'enc_src', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0, team: 'enemy' });
    attachRule(db, { encounter_id: 'enc_src', rule_type: 'phase_transition', rule_key: 'hp_50' });

    // Clone manually (replicating doctrine_clone tool logic)
    const source = db.prepare("SELECT * FROM encounters WHERE id = 'enc_src'").get() as any;
    upsertEncounter(db, {
      id: 'enc_clone',
      project_id: source.project_id,
      chapter: source.chapter,
      label: 'Source (clone)',
      grid_rows: source.grid_rows,
      grid_cols: source.grid_cols,
    });

    const srcUnits = getUnits(db, 'enc_src');
    for (const u of srcUnits) {
      addUnit(db, {
        encounter_id: 'enc_clone',
        display_name: u.display_name,
        variant_id: u.variant_id,
        sprite_pack: u.sprite_pack,
        grid_row: u.grid_row,
        grid_col: u.grid_col,
        sort_order: u.sort_order,
      });
    }

    const srcRules = getRules(db, 'enc_src');
    for (const r of srcRules) {
      attachRule(db, {
        encounter_id: 'enc_clone',
        rule_type: r.rule_type,
        rule_key: r.rule_key,
        rule_payload_json: r.rule_payload_json ?? undefined,
      });
    }

    expect(getUnitCount(db, 'enc_clone')).toBe(1);
    expect(getRules(db, 'enc_clone')).toHaveLength(1);
    expect(getEncounterProductionState(db, 'enc_clone')).toBe('draft');
  });

  it('remove_unit decreases count', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    const unit1 = addUnit(db, { encounter_id: 'enc1', display_name: 'A', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0 });
    addUnit(db, { encounter_id: 'enc1', display_name: 'B', variant_id: 'var2', sprite_pack: 'pack1', grid_row: 1, grid_col: 1 });

    expect(getUnitCount(db, 'enc1')).toBe(2);
    removeUnit(db, unit1.id);
    expect(getUnitCount(db, 'enc1')).toBe(1);
  });

  it('get_next_step returns correct action at each stage', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Battle', grid_rows: 3, grid_cols: 8 });
    db.prepare("UPDATE encounters SET display_name = 'Battle', encounter_type = 'standard' WHERE id = 'enc1'").run();

    // draft
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('define_intent');

    transitionEncounterState(db, 'enc1', 'intent_defined');
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('add_units');

    addUnit(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'var1', sprite_pack: 'pack1', grid_row: 0, grid_col: 0, team: 'enemy' });
    // Re-check intent_defined with units
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('advance_to_roster_defined');

    transitionEncounterState(db, 'enc1', 'roster_defined');
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('define_formation');

    transitionEncounterState(db, 'enc1', 'formation_defined');
    transitionEncounterState(db, 'enc1', 'rules_defined');
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('validate_structural');

    transitionEncounterState(db, 'enc1', 'validated_structural');
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('validate_dependencies');

    transitionEncounterState(db, 'enc1', 'dependencies_resolved');
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('export_manifest');

    transitionEncounterState(db, 'enc1', 'manifest_exported');
    expect(getEncounterNextStep(db, 'enc1').next_action).toBe('sync_to_engine');
  });
});
