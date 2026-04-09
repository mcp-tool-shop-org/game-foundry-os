import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  scaffoldChapter,
  computeAuthoringGaps,
  computeFirstPlayablePath,
} from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-e2e', 'E2E Project', '/tmp/e2e');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('v1.8.0 end-to-end: scaffold → gaps → first-playable', () => {
  it('full authoring flow', () => {
    seedProject();

    // 1. Scaffold a chapter with 2 encounters
    const scaffold = scaffoldChapter(db, {
      project_id: 'proj-e2e',
      chapter_id: 'ch1',
      display_name: 'Chapter 1: The Patrol',
      intent_summary: 'Introduce basic combat',
      encounters: [
        { encounter_id: 'enc1', display_name: 'Ambush', intent_summary: 'Tutorial fight' },
        { encounter_id: 'enc2', display_name: 'Boss Gate', encounter_type: 'boss' },
      ],
      defaults: {
        default_grid_rows: 4,
        default_grid_cols: 10,
      },
    });

    expect(scaffold.encounters_created).toHaveLength(2);
    expect(scaffold.scene_contracts_created).toHaveLength(2);
    expect(scaffold.layers_configured).toBe(10);

    // 2. Check authoring gaps — roster should be missing
    let gaps = computeAuthoringGaps(db, 'ch1');
    expect(gaps.blocker_count).toBeGreaterThanOrEqual(2); // at least 2 roster gaps
    const rosterGaps = gaps.gaps.filter(g => g.domain === 'roster');
    expect(rosterGaps).toHaveLength(2);

    // 3. Check first-playable path
    let path = computeFirstPlayablePath(db, 'ch1');
    expect(path.steps[0].status).toBe('done'); // chapter declared
    expect(path.steps[1].status).toBe('done'); // encounters created
    expect(path.steps[2].status).toBe('pending'); // roster needed
    expect(path.is_playable).toBe(false);

    // 4. Add units to both encounters
    addEnemy(db, {
      encounter_id: 'enc1',
      display_name: 'Raider',
      variant_id: 'raider_base',
      sprite_pack: 'enemies',
      grid_row: 1,
      grid_col: 3,
    });
    addEnemy(db, {
      encounter_id: 'enc2',
      display_name: 'Boss',
      variant_id: 'boss_base',
      sprite_pack: 'bosses',
      grid_row: 1,
      grid_col: 5,
    });

    // 5. Gaps should have reduced — roster gaps gone
    gaps = computeAuthoringGaps(db, 'ch1');
    const rosterGapsAfter = gaps.gaps.filter(g => g.domain === 'roster');
    expect(rosterGapsAfter).toHaveLength(0);

    // 6. First-playable path should advance
    path = computeFirstPlayablePath(db, 'ch1');
    expect(path.steps[2].status).toBe('done'); // roster now filled
    expect(path.steps[3].status).toBe('done'); // scene contracts (from scaffold)
    expect(path.steps[4].status).toBe('done'); // layers (from scaffold)
    expect(path.steps[5].status).toBe('pending'); // structural validation next
    expect(path.current_step).toBe(5);
    expect(path.overall_progress_pct).toBeGreaterThan(50);
  });
});
