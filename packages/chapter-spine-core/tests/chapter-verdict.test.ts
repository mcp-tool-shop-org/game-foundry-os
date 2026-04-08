import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract, configureDefaultLayers, captureAllSnapshots,
  runSceneProof, startPlaytest, completePlaytest, recordPlaytestFailures,
} from '@mcptoolshop/battle-scene-core';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';
import { createChapter, computeChapterVerdict } from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() { upsertProject(db, 'proj-vd', 'Verdict Project', '/tmp/vd'); }

function addFullEnemy(encId: string, name = 'Guard') {
  addEnemy(db, { encounter_id: encId, display_name: name, variant_id: `${name.toLowerCase()}_base`, sprite_pack: 'enemies', grid_row: 1, grid_col: 3, ai_role: 'tank', hp: 20, guard: 5, speed: 3, move_range: 2 });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE encounter_id = ? AND display_name = ?").run(encId, name);
}

function fullySatisfy(encId: string) {
  const c = createSceneContract(db, 'proj-vd', encId);
  configureDefaultLayers(db, c.id);
  captureAllSnapshots(db, c.id);
  runSceneProof(db, c.id);
  const s = startPlaytest(db, 'proj-vd', encId);
  completePlaytest(db, s.id, 'pass');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('computeChapterVerdict', () => {
  it('playable verdict for fully satisfied chapter', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-vd', chapter: 'ch1', label: 'Patrol' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const v = computeChapterVerdict(db, 'ch1');
    expect(v.verdict).toBe('playable');
    expect(v.verdict_reason).toContain('playable');
    expect(v.blocking_encounter).toBeNull();
    expect(v.blocking_domain).toBeNull();
  });

  it('incomplete verdict when encounter has no scene contract', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-vd', chapter: 'ch1', label: 'Raider Ambush' });

    const v = computeChapterVerdict(db, 'ch1');
    expect(v.verdict).toBe('incomplete');
    expect(v.verdict_reason).toContain('Raider Ambush');
    expect(v.verdict_reason).toContain('scene contract');
    expect(v.blocking_encounter).toBe('enc1');
  });

  it('blocked verdict when scene proof fails', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-vd', chapter: 'ch1', label: 'Boss Fight' });
    addFullEnemy('enc1', 'Boss');
    const c = createSceneContract(db, 'proj-vd', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    // Fail proof with tiny sprites
    const tiny: SpriteMetrics[] = [{ variant_id: 'boss_base', width: 10, height: 10, avg_luminance: 5 }];
    const v = computeChapterVerdict(db, 'ch1', { enc1: tiny });
    expect(v.verdict).toBe('blocked');
    expect(v.verdict_reason).toContain('Boss Fight');
    expect(v.blocking_encounter).toBe('enc1');
    expect(v.blocking_domain).toBe('presentation_integrity');
  });

  it('blocked verdict when playtest fails and required', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Chapter 1', { required_playtest_pass: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-vd', chapter: 'ch1', label: 'Ambush' });
    addFullEnemy('enc1');
    const c = createSceneContract(db, 'proj-vd', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    runSceneProof(db, c.id);
    const s = startPlaytest(db, 'proj-vd', 'enc1');
    completePlaytest(db, s.id, 'fail');

    const v = computeChapterVerdict(db, 'ch1');
    expect(v.verdict).toBe('blocked');
    expect(v.verdict_reason).toContain('playtest failed');
  });

  it('incomplete verdict for empty chapter', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Chapter 1');

    const v = computeChapterVerdict(db, 'ch1');
    expect(v.verdict).toBe('incomplete');
    expect(v.verdict_reason).toContain('no encounters');
  });

  it('verdict_reason names the specific blocking encounter and assertion', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-vd', chapter: 'ch1', label: 'Good' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-vd', chapter: 'ch1', label: 'Bad Ambush' });
    addFullEnemy('enc2', 'Raider');
    const c = createSceneContract(db, 'proj-vd', 'enc2');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);
    const tiny: SpriteMetrics[] = [{ variant_id: 'raider_base', width: 8, height: 8, avg_luminance: 3 }];
    const v = computeChapterVerdict(db, 'ch1', { enc2: tiny });
    expect(v.verdict).toBe('blocked');
    expect(v.verdict_reason).toContain('Bad Ambush');
    expect(v.blocking_encounter).toBe('enc2');
  });

  it('persists verdict to chapter_verdicts table', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-vd', chapter: 'ch1', label: 'Patrol' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const v = computeChapterVerdict(db, 'ch1');
    const row = db.prepare('SELECT * FROM chapter_verdicts WHERE id = ?').get(v.verdict_id) as any;
    expect(row).toBeDefined();
    expect(row.verdict).toBe('playable');
    expect(row.chapter_id).toBe('ch1');
  });

  it('includes full prove bundle', () => {
    seedProject();
    createChapter(db, 'proj-vd', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-vd', chapter: 'ch1', label: 'A' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const v = computeChapterVerdict(db, 'ch1');
    expect(v.prove_bundle).toBeDefined();
    expect(v.prove_bundle.scene_proofs).toHaveLength(1);
  });
});
