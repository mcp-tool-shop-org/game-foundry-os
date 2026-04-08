import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract,
  configureDefaultLayers,
  captureAllSnapshots,
  runSceneProof,
  startPlaytest,
  completePlaytest,
  recordPlaytestFailures,
} from '@mcptoolshop/battle-scene-core';
import {
  createChapter,
  getEncounterCoverageMap,
  computeChapterHealth,
} from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-hlt', 'Health Project', '/tmp/hlt');
}

function addFullEnemy(encId: string) {
  addEnemy(db, {
    encounter_id: encId, display_name: 'Guard', variant_id: 'guard_base',
    sprite_pack: 'guards', grid_row: 1, grid_col: 3, ai_role: 'tank',
    hp: 20, guard: 5, speed: 3, move_range: 2,
  });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE encounter_id = ?").run(encId);
}

function satisfyBattleScene(encId: string) {
  const contract = createSceneContract(db, 'proj-hlt', encId);
  configureDefaultLayers(db, contract.id);
  captureAllSnapshots(db, contract.id);
  runSceneProof(db, contract.id);
  const session = startPlaytest(db, 'proj-hlt', encId);
  completePlaytest(db, session.id, 'pass');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('getEncounterCoverageMap', () => {
  it('returns empty for chapter with no encounters', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    const coverage = getEncounterCoverageMap(db, 'ch1', 'proj-hlt');
    expect(coverage).toHaveLength(0);
  });

  it('marks encounter without scene contract', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Ambush' });

    const coverage = getEncounterCoverageMap(db, 'ch1', 'proj-hlt');
    expect(coverage).toHaveLength(1);
    expect(coverage[0].has_battle_scene_contract).toBe(false);
    expect(coverage[0].has_layers).toBe(false);
    expect(coverage[0].has_snapshots).toBe(false);
    expect(coverage[0].has_proof_pass).toBe(false);
    expect(coverage[0].has_playtest_pass).toBe(false);
  });

  it('marks encounter with full battle scene setup', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    satisfyBattleScene('enc1');

    const coverage = getEncounterCoverageMap(db, 'ch1', 'proj-hlt');
    expect(coverage[0].has_battle_scene_contract).toBe(true);
    expect(coverage[0].has_layers).toBe(true);
    expect(coverage[0].has_snapshots).toBe(true);
    expect(coverage[0].has_playtest_pass).toBe(true);
  });

  it('counts major findings for encounter with missing contract', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Ambush' });

    const coverage = getEncounterCoverageMap(db, 'ch1', 'proj-hlt');
    expect(coverage[0].major_findings).toBeGreaterThan(0);
  });
});

describe('computeChapterHealth', () => {
  it('returns incomplete for chapter with no encounters', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    const health = computeChapterHealth(db, 'ch1');

    expect(health.overall_status).toBe('incomplete');
    expect(health.blocker_summary).toContain('No encounters');
    expect(health.next_action).toBe('create_encounter');
  });

  it('returns blocked for chapter with encounter missing scene contract', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Raider Ambush' });

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).toBe('incomplete');
    expect(health.blocker_summary).toContain('Raider Ambush');
    expect(health.next_action).toBe('battle_create_scene_contract');
    expect(health.next_action_target).toBe('enc1');
  });

  it('returns ready when all encounters fully satisfied', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    satisfyBattleScene('enc1');

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).toBe('ready');
    expect(health.blocker_summary).toBeNull();
    expect(health.next_action).toBe('continue_production');
  });

  it('surfaces exact blocker encounter by name', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc-good', project_id: 'proj-hlt', chapter: 'ch1', label: 'Easy Patrol' });
    addFullEnemy('enc-good');
    satisfyBattleScene('enc-good');
    upsertEncounter(db, { id: 'enc-bad', project_id: 'proj-hlt', chapter: 'ch1', label: 'Hard Ambush' });
    // enc-bad has no scene contract

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).not.toBe('ready');
    expect(health.blocker_summary).toContain('Hard Ambush');
    expect(health.next_action_target).toBe('enc-bad');
  });

  it('playtest failure degrades chapter health when required', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1', { required_playtest_pass: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    // Set up everything except playtest fails
    const contract = createSceneContract(db, 'proj-hlt', 'enc1');
    configureDefaultLayers(db, contract.id);
    captureAllSnapshots(db, contract.id);
    runSceneProof(db, contract.id);
    const session = startPlaytest(db, 'proj-hlt', 'enc1');
    recordPlaytestFailures(db, session.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'Bad' },
    ]);
    completePlaytest(db, session.id, 'fail');

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).not.toBe('ready');
    expect(health.blocker_summary).toContain('playtest');
  });

  it('persists health snapshot to DB', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    const health = computeChapterHealth(db, 'ch1');

    const row = db.prepare('SELECT * FROM chapter_health_snapshots WHERE id = ?').get(health.snapshot_id) as any;
    expect(row).toBeDefined();
    expect(row.overall_status).toBe(health.overall_status);
    expect(row.chapter_id).toBe('ch1');
  });

  it('includes encounter coverage in snapshot', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Ambush' });
    const health = computeChapterHealth(db, 'ch1');

    expect(health.encounter_coverage).toHaveLength(1);
    expect(health.encounter_coverage[0].encounter_id).toBe('enc1');
  });

  it('weakest domain propagated from encounter findings', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Ambush' });
    // No scene contract → weakest domain should be presentation_integrity

    const health = computeChapterHealth(db, 'ch1');
    expect(health.weakest_domain).toBe('presentation_integrity');
  });

  it('throws for nonexistent chapter', () => {
    expect(() => computeChapterHealth(db, 'nonexistent')).toThrow('Chapter not found');
  });

  it('handles multiple encounters with mixed states', () => {
    seedProject();
    createChapter(db, 'proj-hlt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-hlt', chapter: 'ch1', label: 'Good' });
    addFullEnemy('enc1');
    satisfyBattleScene('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-hlt', chapter: 'ch1', label: 'Partial' });
    createSceneContract(db, 'proj-hlt', 'enc2'); // has contract but no layers

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).not.toBe('ready');
    // enc1 is fully set up (proof ran, partial counts as pass)
    expect(health.encounter_coverage.find(e => e.encounter_id === 'enc1')!.has_proof_pass).toBe(true);
    // enc2 has contract but no layers — chapter is incomplete
    expect(health.encounter_coverage.find(e => e.encounter_id === 'enc2')!.has_layers).toBe(false);
  });
});
