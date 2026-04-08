import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract, configureDefaultLayers, captureAllSnapshots,
  runSceneProof, startPlaytest, completePlaytest,
} from '@mcptoolshop/battle-scene-core';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';
import { createChapter, getChapterFreezeCalibration } from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() { upsertProject(db, 'proj-fc', 'Freeze Project', '/tmp/fc'); }

function addFullEnemy(encId: string, name = 'Guard') {
  addEnemy(db, { encounter_id: encId, display_name: name, variant_id: `${name.toLowerCase()}_base`, sprite_pack: 'enemies', grid_row: 1, grid_col: 3, ai_role: 'tank', hp: 20, guard: 5, speed: 3, move_range: 2 });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE encounter_id = ? AND display_name = ?").run(encId, name);
}

function fullySatisfy(encId: string) {
  const c = createSceneContract(db, 'proj-fc', encId);
  configureDefaultLayers(db, c.id);
  captureAllSnapshots(db, c.id);
  runSceneProof(db, c.id);
  const s = startPlaytest(db, 'proj-fc', encId);
  completePlaytest(db, s.id, 'pass');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('getChapterFreezeCalibration', () => {
  it('playable chapter → can freeze, risk clear', () => {
    seedProject();
    createChapter(db, 'proj-fc', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-fc', chapter: 'ch1', label: 'Patrol' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const cal = getChapterFreezeCalibration(db, 'ch1');
    expect(cal.can_freeze).toBe(true);
    expect(cal.freeze_risk).toBe('clear');
    expect(cal.verdict).toBe('playable');
    expect(cal.blockers).toHaveLength(0);
  });

  it('blocked chapter → cannot freeze', () => {
    seedProject();
    createChapter(db, 'proj-fc', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-fc', chapter: 'ch1', label: 'Boss' });
    addFullEnemy('enc1', 'Boss');
    const c = createSceneContract(db, 'proj-fc', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    const tiny: SpriteMetrics[] = [{ variant_id: 'boss_base', width: 8, height: 8, avg_luminance: 3 }];

    const cal = getChapterFreezeCalibration(db, 'ch1', { enc1: tiny });
    expect(cal.can_freeze).toBe(false);
    expect(cal.freeze_risk).toBe('blocked');
    expect(cal.blockers.length).toBeGreaterThan(0);
  });

  it('incomplete chapter → cannot freeze', () => {
    seedProject();
    createChapter(db, 'proj-fc', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-fc', chapter: 'ch1', label: 'No Contract' });

    const cal = getChapterFreezeCalibration(db, 'ch1');
    expect(cal.can_freeze).toBe(false);
    expect(cal.freeze_risk).toBe('blocked');
    expect(cal.verdict).toBe('incomplete');
  });

  it('empty chapter → cannot freeze', () => {
    seedProject();
    createChapter(db, 'proj-fc', 'ch1', 'Ch1');

    const cal = getChapterFreezeCalibration(db, 'ch1');
    expect(cal.can_freeze).toBe(false);
    expect(cal.verdict).toBe('incomplete');
  });

  it('blockers include encounter and domain details', () => {
    seedProject();
    createChapter(db, 'proj-fc', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-fc', chapter: 'ch1', label: 'Broken' });

    const cal = getChapterFreezeCalibration(db, 'ch1');
    expect(cal.blockers.some(b => b.includes('Broken'))).toBe(true);
  });

  it('throws for nonexistent chapter', () => {
    expect(() => getChapterFreezeCalibration(db, 'nonexistent')).toThrow('Chapter not found');
  });
});
