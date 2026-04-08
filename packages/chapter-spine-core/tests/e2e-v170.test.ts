/**
 * E2E v1.7.0 — Playable Chapter Loop hard gate tests
 *
 * Proves:
 * 1. Foundry can produce a playable chapter artifact for Chapter 1
 * 2. The chapter prove bundle runs from one entrypoint
 * 3. A failed encounter proof or playtest blocks the chapter verdict automatically
 * 4. The output identifies the exact blocking encounter and quality domain
 * 5. The handoff artifact is strong enough for the next contributor
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
  createChapter, runChapterProveBundle, computeChapterVerdict,
  generateChapterHandoff, getChapterFreezeCalibration,
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

describe('hard gate 1: produce a playable chapter artifact', () => {
  it('ch1 with 3 encounters → prove → verdict = playable → handoff → freeze = ready', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Chapter 1: The Patrol Route', { sort_order: 1 });

    upsertEncounter(db, { id: 'patrol', project_id: 'proj-e2e', chapter: 'ch1', label: 'Patrol Start' });
    addFullEnemy('patrol', 'Patrol_Guard');
    fullySatisfy('patrol');

    upsertEncounter(db, { id: 'ambush', project_id: 'proj-e2e', chapter: 'ch1', label: 'Raider Ambush' });
    addFullEnemy('ambush', 'Raider_Scout');
    fullySatisfy('ambush');

    upsertEncounter(db, { id: 'bridge', project_id: 'proj-e2e', chapter: 'ch1', label: 'Bridge Crossing' });
    addFullEnemy('bridge', 'Bridge_Troll');
    fullySatisfy('bridge');

    // One prove entrypoint
    const bundle = runChapterProveBundle(db, 'ch1');
    expect(bundle.scene_proofs).toHaveLength(3);
    expect(bundle.blocker_count).toBe(0);

    // Decisive verdict
    const verdict = computeChapterVerdict(db, 'ch1');
    expect(verdict.verdict).toBe('playable');
    expect(verdict.verdict_reason).toContain('playable');

    // Handoff artifact
    const handoff = generateChapterHandoff(db, 'ch1');
    expect(handoff.verdict).toBe('playable');
    expect(handoff.what_was_built.encounter_count).toBe(3);
    expect(handoff.what_passed).toHaveLength(3);
    expect(handoff.what_failed).toHaveLength(0);
    expect(handoff.what_is_blocking).toBeNull();

    // Freeze calibration
    const freeze = getChapterFreezeCalibration(db, 'ch1');
    expect(freeze.can_freeze).toBe(true);
    expect(freeze.freeze_risk).toBe('clear');
  });
});

describe('hard gate 2: prove bundle runs from one entrypoint', () => {
  it('single call produces health + scene proofs + playtest aggregation', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'A' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const bundle = runChapterProveBundle(db, 'ch1');
    expect(bundle.health).toBeDefined();
    expect(bundle.health.encounter_coverage).toHaveLength(1);
    expect(bundle.scene_proofs).toHaveLength(1);
    expect(bundle.scene_proofs[0].proof_result).not.toBeNull();
    expect(bundle.playtest_status).toBeDefined();
    expect(bundle.playtest_status.overall_verdict).toBe('pass');
  });
});

describe('hard gate 3: failed proof/playtest blocks verdict', () => {
  it('failed scene proof → verdict = blocked', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Boss' });
    addFullEnemy('enc1', 'Boss');
    const c = createSceneContract(db, 'proj-e2e', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    const tiny: SpriteMetrics[] = [{ variant_id: 'boss_base', width: 8, height: 8, avg_luminance: 3 }];

    const verdict = computeChapterVerdict(db, 'ch1', { enc1: tiny });
    expect(verdict.verdict).toBe('blocked');
  });

  it('failed playtest → verdict = blocked when required', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1', { required_playtest_pass: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    const c = createSceneContract(db, 'proj-e2e', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    runSceneProof(db, c.id);
    const s = startPlaytest(db, 'proj-e2e', 'enc1');
    completePlaytest(db, s.id, 'fail');

    const verdict = computeChapterVerdict(db, 'ch1');
    expect(verdict.verdict).toBe('blocked');
    expect(verdict.verdict_reason).toContain('playtest');
  });
});

describe('hard gate 4: output identifies exact blocker', () => {
  it('verdict names blocking encounter and domain', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'good', project_id: 'proj-e2e', chapter: 'ch1', label: 'Easy' });
    addFullEnemy('good');
    fullySatisfy('good');

    upsertEncounter(db, { id: 'bad', project_id: 'proj-e2e', chapter: 'ch1', label: 'Hard Ambush' });
    addFullEnemy('bad', 'Raider');
    const c = createSceneContract(db, 'proj-e2e', 'bad');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    const tiny: SpriteMetrics[] = [{ variant_id: 'raider_base', width: 8, height: 8, avg_luminance: 3 }];

    const verdict = computeChapterVerdict(db, 'ch1', { bad: tiny });
    expect(verdict.blocking_encounter).toBe('bad');
    expect(verdict.blocking_domain).toBe('presentation_integrity');
    expect(verdict.verdict_reason).toContain('Hard Ambush');
  });

  it('handoff what_failed lists the specific encounter', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Good' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-e2e', chapter: 'ch1', label: 'Missing Layers' });
    createSceneContract(db, 'proj-e2e', 'enc2'); // no layers

    const handoff = generateChapterHandoff(db, 'ch1');
    expect(handoff.what_failed.length).toBeGreaterThan(0);
    expect(handoff.what_failed.some(f => f.label === 'Missing Layers')).toBe(true);
  });
});

describe('hard gate 5: handoff strong enough for next contributor', () => {
  it('handoff includes everything needed to continue', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Chapter 1: The Patrol Route');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Patrol' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-e2e', chapter: 'ch1', label: 'Ambush' });
    // enc2 missing everything

    const handoff = generateChapterHandoff(db, 'ch1');

    // Structure for handoff recipient
    expect(handoff.chapter_id).toBe('ch1');
    expect(handoff.display_name).toBe('Chapter 1: The Patrol Route');
    expect(handoff.verdict).toBeTruthy();
    expect(handoff.verdict_reason).toBeTruthy();
    expect(handoff.what_was_built.encounter_count).toBe(2);
    expect(handoff.what_passed.length).toBeGreaterThanOrEqual(1);
    expect(handoff.what_failed.length).toBeGreaterThanOrEqual(1);
    expect(handoff.next_highest_value_move.action).toBeTruthy();
    expect(handoff.encounter_detail).toHaveLength(2);
    expect(handoff.playtest_summary).toBeDefined();
    expect(handoff.generated_at).toBeTruthy();
    expect(handoff.artifact_id).toMatch(/^cha_/);
  });

  it('handoff persists to handoff_artifacts table', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'A' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const handoff = generateChapterHandoff(db, 'ch1');
    const row = db.prepare('SELECT * FROM handoff_artifacts WHERE id = ?').get(handoff.artifact_id) as any;
    expect(row).toBeDefined();
    expect(row.artifact_type).toBe('chapter_build_report');
    expect(row.scope_type).toBe('chapter');
    expect(row.scope_id).toBe('ch1');
  });

  it('freeze calibration gates blocked chapter from freezing', () => {
    seedProject();
    createChapter(db, 'proj-e2e', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-e2e', chapter: 'ch1', label: 'Bad' });
    addFullEnemy('enc1', 'Boss');
    const c = createSceneContract(db, 'proj-e2e', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    const tiny: SpriteMetrics[] = [{ variant_id: 'boss_base', width: 8, height: 8, avg_luminance: 3 }];

    const freeze = getChapterFreezeCalibration(db, 'ch1', { enc1: tiny });
    expect(freeze.can_freeze).toBe(false);
    expect(freeze.freeze_risk).toBe('blocked');
    expect(freeze.blockers.length).toBeGreaterThan(0);
  });
});
