/**
 * E2E v1.6.0 — Chapter Spine hard gate tests
 *
 * Proves:
 * 1. Foundry can answer "Is Chapter 1 shippable?"
 * 2. One chapter can surface exact blockers by encounter
 * 3. Playtest failures degrade chapter health automatically
 * 4. Presentation failures in one battle scene show up as chapter risk
 * 5. get_next_step recommends the highest-value chapter move
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract, configureDefaultLayers, captureAllSnapshots,
  runSceneProof, startPlaytest, completePlaytest, recordPlaytestFailures,
} from '@mcptoolshop/battle-scene-core';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';
import {
  createChapter, computeChapterHealth, getChapterNextStep, getChapterPlaytestStatus,
} from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() { upsertProject(db, 'proj-e2e', 'E2E Project', '/tmp/e2e'); }

function addFullEnemy(encId: string, name = 'Guard') {
  addEnemy(db, { encounter_id: encId, display_name: name, variant_id: `${name.toLowerCase()}_base`, sprite_pack: 'enemies', grid_row: 1, grid_col: 3, ai_role: 'tank', hp: 20, guard: 5, speed: 3, move_range: 2 });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE encounter_id = ? AND display_name = ?").run(encId, name);
}

function fullySatisfy(encId: string) {
  const c = createSceneContract(db, 'proj-e2e', encId);
  configureDefaultLayers(db, c.id);
  captureAllSnapshots(db, c.id);
  runSceneProof(db, c.id);
  const s = startPlaytest(db, 'proj-e2e', encId);
  completePlaytest(db, s.id, 'pass');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('hard gate 1: "Is Chapter 1 shippable?"', () => {
  it('chapter with all encounters passing = ready', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Chapter 1: The Patrol Route', { sort_order: 1 });
    upsertEncounter(db, { id: 'raider_ambush', project_id: 'proj-e2e', chapter: 'ch1', label: 'Raider Ambush' });
    addFullEnemy('raider_ambush', 'Raider Scout');
    fullySatisfy('raider_ambush');

    upsertEncounter(db, { id: 'patrol_start', project_id: 'proj-e2e', chapter: 'ch1', label: 'Patrol Start' });
    addFullEnemy('patrol_start', 'Patrol Guard');
    fullySatisfy('patrol_start');

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).toBe('ready');
    expect(health.blocker_summary).toBeNull();
    expect(health.encounter_coverage).toHaveLength(2);
    expect(health.encounter_coverage.every(e => e.has_proof_pass)).toBe(true);
  });
});

describe('hard gate 2: surface exact blockers by encounter', () => {
  it('names the blocking encounter when one is missing scene contract', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc_good', project_id: 'proj-e2e', chapter: 'ch1', label: 'Easy Patrol' });
    addFullEnemy('enc_good');
    fullySatisfy('enc_good');

    upsertEncounter(db, { id: 'enc_bad', project_id: 'proj-e2e', chapter: 'ch1', label: 'Raider Ambush' });
    // No scene contract for enc_bad

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).toBe('incomplete');
    expect(health.blocker_summary).toContain('Raider Ambush');
    expect(health.next_action_target).toBe('enc_bad');
  });

  it('coverage map shows per-encounter detail', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Enc 1' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-e2e', chapter: 'ch1', label: 'Enc 2' });
    upsertEncounter(db, { id: 'enc3', project_id: 'proj-e2e', chapter: 'ch1', label: 'Enc 3' });
    createSceneContract(db, 'proj-e2e', 'enc3'); // only contract, no layers

    const health = computeChapterHealth(db, 'ch1');
    const map = health.encounter_coverage;

    expect(map.find(e => e.encounter_id === 'enc1')!.has_battle_scene_contract).toBe(true);
    expect(map.find(e => e.encounter_id === 'enc2')!.has_battle_scene_contract).toBe(false);
    expect(map.find(e => e.encounter_id === 'enc3')!.has_layers).toBe(false);
  });
});

describe('hard gate 3: playtest failures degrade chapter health', () => {
  it('failing playtest on one encounter blocks chapter when playtest required', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1', { required_playtest_pass: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    const c = createSceneContract(db, 'proj-e2e', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    runSceneProof(db, c.id);
    const s = startPlaytest(db, 'proj-e2e', 'enc1');
    recordPlaytestFailures(db, s.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'Lost against bg' },
    ]);
    completePlaytest(db, s.id, 'fail');

    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).not.toBe('ready');

    const ptStatus = getChapterPlaytestStatus(db, 'ch1');
    expect(ptStatus.overall_verdict).toBe('fail');
    expect(ptStatus.failing_encounters).toContain('enc1');
  });

  it('playtest aggregation shows overall chapter verdict', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'A' });
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-e2e', chapter: 'ch1', label: 'B' });
    const s1 = startPlaytest(db, 'proj-e2e', 'enc1');
    completePlaytest(db, s1.id, 'pass');
    const s2 = startPlaytest(db, 'proj-e2e', 'enc2');
    completePlaytest(db, s2.id, 'marginal');

    const ptStatus = getChapterPlaytestStatus(db, 'ch1');
    expect(ptStatus.overall_verdict).toBe('marginal');
    expect(ptStatus.tested_encounters).toBe(2);
  });
});

describe('hard gate 4: presentation failures show up as chapter risk', () => {
  it('tiny sprites in one encounter → chapter not ready', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    const c = createSceneContract(db, 'proj-e2e', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);

    // Run proof with tiny sprites → fails
    const tinySprites: SpriteMetrics[] = [
      { variant_id: 'guard_base', width: 12, height: 12, avg_luminance: 80 },
    ];
    const proofResult = runSceneProof(db, c.id, tinySprites);
    expect(proofResult.result).toBe('fail');

    // Chapter health should reflect this
    const health = computeChapterHealth(db, 'ch1');
    expect(health.overall_status).toBe('blocked');
    expect(health.weakest_domain).toBeTruthy();
  });
});

describe('hard gate 5: get_next_step recommends highest-value chapter move', () => {
  it('chapter next-step points to worst encounter with exact action', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Easy Patrol' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    upsertEncounter(db, { id: 'enc2', project_id: 'proj-e2e', chapter: 'ch1', label: 'Hard Ambush' });
    // enc2 has no scene contract

    const step = getChapterNextStep(db, 'ch1');
    expect(step.target_encounter).toBe('enc2');
    expect(step.action).toBe('battle_create_scene_contract');
    // enc2 is in draft state → encounter_integrity outranks presentation_integrity
    expect(step.quality_domain).toBeTruthy();
    expect(step.why_it_matters).toBeTruthy();
  });

  it('chapter next-step says continue_production when all healthy', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Patrol' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-e2e', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc2', 'Raider');
    fullySatisfy('enc2');

    const step = getChapterNextStep(db, 'ch1');
    expect(step.action).toBe('continue_production');
    expect(step.chapter_status).toBe('ready');
  });

  it('3 encounters, 1 failing proof → next-step names it', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');

    // Good encounter 1
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Easy' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    // Good encounter 2
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-e2e', chapter: 'ch1', label: 'Medium' });
    addFullEnemy('enc2', 'Archer');
    fullySatisfy('enc2');

    // Bad encounter 3 — has contract but proof fails
    upsertEncounter(db, { id: 'enc3', project_id: 'proj-e2e', chapter: 'ch1', label: 'Boss Fight' });
    addFullEnemy('enc3', 'Boss');
    const c = createSceneContract(db, 'proj-e2e', 'enc3');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    const tinySprites: SpriteMetrics[] = [
      { variant_id: 'boss_base', width: 10, height: 10, avg_luminance: 5 },
    ];
    runSceneProof(db, c.id, tinySprites);

    const step = getChapterNextStep(db, 'ch1');
    expect(step.chapter_status).toBe('blocked');
    expect(step.target_encounter).toBe('enc3');
    expect(step.priority).toBe('critical');
  });
});
