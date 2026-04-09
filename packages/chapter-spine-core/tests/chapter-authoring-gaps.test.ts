import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertEncounter,
  addEnemy,
} from '@mcptoolshop/game-foundry-registry';
import {
  createChapter,
  setChapterDefaults,
  scaffoldChapter,
  computeAuthoringGaps,
} from '@mcptoolshop/chapter-spine-core';
import { createSceneContract, configureDefaultLayers } from '@mcptoolshop/battle-scene-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-gap', 'Gaps Project', '/tmp/gap');
}

function addFullEnemy(encId: string, name = 'Guard') {
  addEnemy(db, {
    encounter_id: encId,
    display_name: name,
    variant_id: `${name.toLowerCase()}_base`,
    sprite_pack: 'enemies',
    grid_row: 1,
    grid_col: 3,
  });
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('computeAuthoringGaps', () => {
  it('reports encounter_count gap when insufficient encounters', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1', { required_encounter_count: 3 });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Fight 1' });

    const result = computeAuthoringGaps(db, 'ch1');
    const countGap = result.gaps.find(g => g.domain === 'encounter_count');
    expect(countGap).toBeDefined();
    expect(countGap!.severity).toBe('warning');
    expect(countGap!.description).toContain('3');
    expect(countGap!.description).toContain('1');
  });

  it('reports roster blocker when encounter has no units', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Empty Fight' });

    const result = computeAuthoringGaps(db, 'ch1');
    const rosterGap = result.gaps.find(g => g.domain === 'roster');
    expect(rosterGap).toBeDefined();
    expect(rosterGap!.severity).toBe('blocker');
    expect(rosterGap!.gap_type).toBe('no_roster');
  });

  it('reports missing variant as blocker', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Fight' });
    addFullEnemy('enc1', 'Ghost'); // variant 'ghost_base' not registered

    const result = computeAuthoringGaps(db, 'ch1');
    const variantGap = result.gaps.find(g => g.domain === 'variant_registry');
    expect(variantGap).toBeDefined();
    expect(variantGap!.severity).toBe('blocker');
    expect(variantGap!.description).toContain('ghost_base');
  });

  it('reports missing sprite pack as blocker', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Fight' });
    addFullEnemy('enc1'); // sprite_pack 'enemies' not registered as asset_pack

    const result = computeAuthoringGaps(db, 'ch1');
    const packGap = result.gaps.find(g => g.domain === 'sprite_pack');
    expect(packGap).toBeDefined();
    expect(packGap!.severity).toBe('blocker');
  });

  it('reports missing scene contract as blocker when required', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1');
    setChapterDefaults(db, { chapter_id: 'ch1', project_id: 'proj-gap', require_scene_contract: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Fight' });
    addFullEnemy('enc1');

    const result = computeAuthoringGaps(db, 'ch1');
    const sceneGap = result.gaps.find(g => g.domain === 'scene_contract');
    expect(sceneGap).toBeDefined();
    expect(sceneGap!.severity).toBe('blocker');
  });

  it('reports missing UI layers as blocker when required', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1');
    setChapterDefaults(db, { chapter_id: 'ch1', project_id: 'proj-gap', require_ui_layers: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Fight' });
    addFullEnemy('enc1');
    createSceneContract(db, 'proj-gap', 'enc1'); // no layers configured

    const result = computeAuthoringGaps(db, 'ch1');
    const layerGap = result.gaps.find(g => g.domain === 'ui_layers');
    expect(layerGap).toBeDefined();
    expect(layerGap!.severity).toBe('blocker');
    expect(layerGap!.description).toContain('0/5');
  });

  it('reports missing canon link as warning when required', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1');
    setChapterDefaults(db, { chapter_id: 'ch1', project_id: 'proj-gap', require_canon_link: true });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Fight' });
    addFullEnemy('enc1');

    const result = computeAuthoringGaps(db, 'ch1');
    const canonGap = result.gaps.find(g => g.domain === 'canon');
    expect(canonGap).toBeDefined();
    expect(canonGap!.severity).toBe('warning');
  });

  it('scaffolded chapter with scene contracts has no scene/layer gaps', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-gap',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Fight' }],
    });

    const result = computeAuthoringGaps(db, 'ch1');
    const sceneGap = result.gaps.find(g => g.domain === 'scene_contract');
    const layerGap = result.gaps.find(g => g.domain === 'ui_layers');
    expect(sceneGap).toBeUndefined();
    expect(layerGap).toBeUndefined();
  });

  it('counts blockers and warnings correctly', () => {
    seedProject();
    createChapter(db, 'proj-gap', 'ch1', 'Chapter 1', { required_encounter_count: 5 });
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-gap', chapter: 'ch1', label: 'Fight' });
    // no units = roster blocker, no scene = scene blocker, encounter count warning

    const result = computeAuthoringGaps(db, 'ch1');
    expect(result.blocker_count).toBeGreaterThanOrEqual(1); // at least roster
    expect(result.warning_count).toBeGreaterThanOrEqual(1); // encounter_count
    expect(result.total_gaps).toBe(result.blocker_count + result.warning_count);
  });
});
