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
  scaffoldChapter,
  computeFirstPlayablePath,
} from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-fpp', 'FPP Project', '/tmp/fpp');
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

describe('computeFirstPlayablePath', () => {
  it('empty chapter: step 0 done, step 1 pending, rest blocked', () => {
    seedProject();
    createChapter(db, 'proj-fpp', 'ch1', 'Chapter 1');

    const result = computeFirstPlayablePath(db, 'ch1');
    expect(result.steps[0].status).toBe('done'); // chapter declared
    expect(result.steps[1].status).toBe('pending'); // encounters created
    expect(result.steps[2].status).toBe('blocked'); // roster
    expect(result.is_playable).toBe(false);
    expect(result.current_step).toBe(1);
  });

  it('chapter with encounters but no roster', () => {
    seedProject();
    createChapter(db, 'proj-fpp', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-fpp', chapter: 'ch1', label: 'Fight' });

    const result = computeFirstPlayablePath(db, 'ch1');
    expect(result.steps[0].status).toBe('done'); // chapter
    expect(result.steps[1].status).toBe('done'); // encounters
    expect(result.steps[2].status).toBe('pending'); // roster
    expect(result.steps[3].status).toBe('blocked'); // scene contracts
    expect(result.current_step).toBe(2);
  });

  it('scaffolded chapter has steps 0-1 done, step 2 pending, steps 3-4 done (from scaffold)', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-fpp',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Fight' }],
    });
    // Scaffold creates chapter + encounter + scene contract + layers
    // but no roster, so step 2 (roster) is pending
    // Steps 3-4 are 'done' because scene contracts and layers exist

    const result = computeFirstPlayablePath(db, 'ch1');
    expect(result.steps[0].status).toBe('done'); // chapter
    expect(result.steps[1].status).toBe('done'); // encounters
    expect(result.steps[2].status).toBe('pending'); // roster (no units added)
    expect(result.steps[3].status).toBe('done'); // scene contracts exist from scaffold
    expect(result.steps[4].status).toBe('done'); // layers exist from scaffold
  });

  it('scaffolded chapter with units advances further', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-fpp',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Fight' }],
    });
    addFullEnemy('enc1');

    const result = computeFirstPlayablePath(db, 'ch1');
    expect(result.steps[0].status).toBe('done'); // chapter
    expect(result.steps[1].status).toBe('done'); // encounters
    expect(result.steps[2].status).toBe('done'); // roster
    expect(result.steps[3].status).toBe('done'); // scene contracts (from scaffold)
    expect(result.steps[4].status).toBe('done'); // layers (from scaffold)
    expect(result.steps[5].status).toBe('pending'); // validation
  });

  it('progress percentage is correct', () => {
    seedProject();
    createChapter(db, 'proj-fpp', 'ch1', 'Chapter 1');
    // Only step 0 is done (9 total steps)

    const result = computeFirstPlayablePath(db, 'ch1');
    // Steps done: 0 (chapter declared) + 7 (playtest not required) = 2/9 ≈ 22%
    expect(result.overall_progress_pct).toBe(22);
  });

  it('playtest step auto-done when not required', () => {
    seedProject();
    createChapter(db, 'proj-fpp', 'ch1', 'Chapter 1');

    const result = computeFirstPlayablePath(db, 'ch1');
    // Step 7 is playtests — 'done' because playtest is not required (check returns done=true)
    expect(result.steps[7].label).toBe('All playtests pass');
    expect(result.steps[7].status).toBe('done');
  });

  it('next_action recommends correct tool', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-fpp',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Fight' }],
    });

    const result = computeFirstPlayablePath(db, 'ch1');
    expect(result.next_action).toContain('doctrine_add_unit');
  });

  it('throws for nonexistent chapter', () => {
    expect(() => computeFirstPlayablePath(db, 'nope')).toThrow('Chapter not found');
  });
});
