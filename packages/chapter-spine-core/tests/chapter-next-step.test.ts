import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import { createSceneContract, configureDefaultLayers, captureAllSnapshots, runSceneProof, startPlaytest, completePlaytest, recordPlaytestFailures } from '@mcptoolshop/battle-scene-core';
import { createChapter, getChapterNextStep } from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() { upsertProject(db, 'proj-ns', 'NS Project', '/tmp/ns'); }

function addFullEnemy(encId: string) {
  addEnemy(db, { encounter_id: encId, display_name: 'Guard', variant_id: 'guard_base', sprite_pack: 'guards', grid_row: 1, grid_col: 3, ai_role: 'tank', hp: 20, guard: 5, speed: 3, move_range: 2 });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE encounter_id = ?").run(encId);
}

function satisfyEncounter(encId: string) {
  addFullEnemy(encId);
  const c = createSceneContract(db, 'proj-ns', encId);
  configureDefaultLayers(db, c.id);
  captureAllSnapshots(db, c.id);
  runSceneProof(db, c.id);
  const s = startPlaytest(db, 'proj-ns', encId);
  completePlaytest(db, s.id, 'pass');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('getChapterNextStep', () => {
  it('empty chapter → create_encounter', () => {
    seedProject();
    createChapter(db, 'proj-ns', 'ch1', 'Ch1');
    const step = getChapterNextStep(db, 'ch1');

    expect(step.action).toBe('create_encounter');
    expect(step.priority).toBe('normal');
    expect(step.chapter_status).toBe('incomplete');
  });

  it('chapter with encounter missing scene contract → battle_create_scene_contract', () => {
    seedProject();
    createChapter(db, 'proj-ns', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-ns', chapter: 'ch1', label: 'Ambush' });

    const step = getChapterNextStep(db, 'ch1');
    expect(step.action).toBe('battle_create_scene_contract');
    expect(step.target_encounter).toBe('enc1');
    expect(step.quality_domain).toBe('presentation_integrity');
  });

  it('chapter with all encounters satisfied → continue_production', () => {
    seedProject();
    createChapter(db, 'proj-ns', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-ns', chapter: 'ch1', label: 'Ambush' });
    satisfyEncounter('enc1');

    const step = getChapterNextStep(db, 'ch1');
    expect(step.action).toBe('continue_production');
    expect(step.priority).toBe('low');
    expect(step.chapter_status).toBe('ready');
  });

  it('playtest failure surfaces as chapter risk', () => {
    seedProject();
    createChapter(db, 'proj-ns', 'ch1', 'Ch1', { required_playtest_pass: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-ns', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    const c = createSceneContract(db, 'proj-ns', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    runSceneProof(db, c.id);
    const s = startPlaytest(db, 'proj-ns', 'enc1');
    completePlaytest(db, s.id, 'fail');

    const step = getChapterNextStep(db, 'ch1');
    expect(step.action).not.toBe('continue_production');
    expect(step.chapter_status).not.toBe('ready');
  });

  it('targets worst encounter in multi-encounter chapter', () => {
    seedProject();
    createChapter(db, 'proj-ns', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc-good', project_id: 'proj-ns', chapter: 'ch1', label: 'Good' });
    satisfyEncounter('enc-good');
    upsertEncounter(db, { id: 'enc-bad', project_id: 'proj-ns', chapter: 'ch1', label: 'Bad' });
    // enc-bad has no scene contract

    const step = getChapterNextStep(db, 'ch1');
    expect(step.target_encounter).toBe('enc-bad');
    expect(step.action).toBe('battle_create_scene_contract');
  });

  it('includes why_it_matters from domain', () => {
    seedProject();
    createChapter(db, 'proj-ns', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-ns', chapter: 'ch1', label: 'Ambush' });

    const step = getChapterNextStep(db, 'ch1');
    expect(step.why_it_matters).toBeTruthy();
    expect(step.why_it_matters.length).toBeGreaterThan(10);
  });

  it('throws for nonexistent chapter', () => {
    expect(() => getChapterNextStep(db, 'nonexistent')).toThrow('Chapter not found');
  });
});
