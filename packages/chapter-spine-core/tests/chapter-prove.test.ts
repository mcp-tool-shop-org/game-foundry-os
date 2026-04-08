import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract, configureDefaultLayers, captureAllSnapshots,
  runSceneProof, startPlaytest, completePlaytest, recordPlaytestFailures,
} from '@mcptoolshop/battle-scene-core';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';
import {
  createChapter, runChapterProveBundle,
} from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() { upsertProject(db, 'proj-pv', 'Prove Project', '/tmp/pv'); }

function addFullEnemy(encId: string, name = 'Guard') {
  addEnemy(db, { encounter_id: encId, display_name: name, variant_id: `${name.toLowerCase()}_base`, sprite_pack: 'enemies', grid_row: 1, grid_col: 3, ai_role: 'tank', hp: 20, guard: 5, speed: 3, move_range: 2 });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE encounter_id = ? AND display_name = ?").run(encId, name);
}

function fullySatisfy(encId: string) {
  const c = createSceneContract(db, 'proj-pv', encId);
  configureDefaultLayers(db, c.id);
  captureAllSnapshots(db, c.id);
  runSceneProof(db, c.id);
  const s = startPlaytest(db, 'proj-pv', encId);
  completePlaytest(db, s.id, 'pass');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('runChapterProveBundle', () => {
  it('returns complete prove result for chapter with encounters', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'Patrol' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const result = runChapterProveBundle(db, 'ch1');
    expect(result.chapter_id).toBe('ch1');
    expect(result.project_id).toBe('proj-pv');
    expect(result.health).toBeDefined();
    expect(result.scene_proofs).toHaveLength(1);
    expect(result.playtest_status).toBeDefined();
  });

  it('scene_proofs includes proof result for each encounter with contract', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'A' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');

    const result = runChapterProveBundle(db, 'ch1');
    expect(result.scene_proofs[0].proof_result).not.toBeNull();
    expect(result.scene_proofs[0].contract_id).toBeTruthy();
    expect(result.scene_proofs[0].proof_result!.assertions.length).toBe(13);
  });

  it('scene_proofs has null proof for encounter without contract', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'Bare' });

    const result = runChapterProveBundle(db, 'ch1');
    expect(result.scene_proofs[0].proof_result).toBeNull();
    expect(result.scene_proofs[0].contract_id).toBeNull();
  });

  it('blocker_count includes missing contracts as blockers', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'No Contract' });

    const result = runChapterProveBundle(db, 'ch1');
    expect(result.blocker_count).toBeGreaterThan(0);
  });

  it('blocker_count aggregates failures across all scene proofs', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'Good' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-pv', chapter: 'ch1', label: 'No Contract' });

    const result = runChapterProveBundle(db, 'ch1');
    // enc1 has proof (partial = 0 blockers), enc2 has no contract (1 blocker)
    expect(result.blocker_count).toBeGreaterThanOrEqual(1);
  });

  it('playtest_status reflects aggregated verdicts', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'A' });
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-pv', chapter: 'ch1', label: 'B' });
    const s1 = startPlaytest(db, 'proj-pv', 'enc1');
    completePlaytest(db, s1.id, 'pass');
    // enc2 has no playtest

    const result = runChapterProveBundle(db, 'ch1');
    expect(result.playtest_status.overall_verdict).toBe('incomplete');
    expect(result.playtest_status.untested_encounters).toContain('enc2');
  });

  it('handles empty chapter', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    const result = runChapterProveBundle(db, 'ch1');

    expect(result.scene_proofs).toHaveLength(0);
    expect(result.blocker_count).toBe(0);
    expect(result.playtest_status.overall_verdict).toBe('untested');
  });

  it('throws for nonexistent chapter', () => {
    expect(() => runChapterProveBundle(db, 'nonexistent')).toThrow('Chapter not found');
  });

  it('warning_count aggregates from all scene proofs', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'A' });
    addFullEnemy('enc1');
    // Contract + layers + snapshots but no sprite metrics → warnings
    const c = createSceneContract(db, 'proj-pv', 'enc1');
    configureDefaultLayers(db, c.id);
    captureAllSnapshots(db, c.id);

    const result = runChapterProveBundle(db, 'ch1');
    expect(result.warning_count).toBeGreaterThan(0);
  });

  it('runs proofs for multiple encounters independently', () => {
    seedProject();
    createChapter(db, 'proj-pv', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pv', chapter: 'ch1', label: 'A' });
    addFullEnemy('enc1');
    fullySatisfy('enc1');
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-pv', chapter: 'ch1', label: 'B' });
    addFullEnemy('enc2', 'Archer');
    fullySatisfy('enc2');

    const result = runChapterProveBundle(db, 'ch1');
    expect(result.scene_proofs).toHaveLength(2);
    expect(result.scene_proofs.every(p => p.proof_result !== null)).toBe(true);
  });
});
