import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  createChapter,
  setChapterDefaults,
  getChapterDefaults,
  resolveDefaults,
} from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-def', 'Defaults Project', '/tmp/def');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('setChapterDefaults', () => {
  it('creates defaults row with correct values', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');

    const defaults = setChapterDefaults(db, {
      chapter_id: 'ch1',
      project_id: 'proj-def',
      default_grid_rows: 4,
      default_grid_cols: 10,
      default_tile_size_px: 48,
    });

    expect(defaults.chapter_id).toBe('ch1');
    expect(defaults.default_grid_rows).toBe(4);
    expect(defaults.default_grid_cols).toBe(10);
    expect(defaults.default_tile_size_px).toBe(48);
    expect(defaults.default_viewport_width).toBe(1280); // system default
  });

  it('upserts on second call', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');

    setChapterDefaults(db, { chapter_id: 'ch1', project_id: 'proj-def', default_grid_rows: 3 });
    const updated = setChapterDefaults(db, { chapter_id: 'ch1', project_id: 'proj-def', default_grid_rows: 5 });

    expect(updated.default_grid_rows).toBe(5);
  });

  it('throws for nonexistent chapter', () => {
    seedProject();
    expect(() => setChapterDefaults(db, { chapter_id: 'nope', project_id: 'proj-def' }))
      .toThrow('Chapter not found');
  });

  it('emits state_events entry', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');
    setChapterDefaults(db, { chapter_id: 'ch1', project_id: 'proj-def' });

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'chapter_defaults' AND entity_id = 'ch1'"
    ).all() as any[];
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].to_state).toBe('set');
  });
});

describe('getChapterDefaults', () => {
  it('returns the defaults row', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');
    setChapterDefaults(db, { chapter_id: 'ch1', project_id: 'proj-def', default_grid_rows: 4 });

    const row = getChapterDefaults(db, 'ch1');
    expect(row).toBeDefined();
    expect(row!.default_grid_rows).toBe(4);
  });

  it('returns undefined for chapter without defaults', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');
    expect(getChapterDefaults(db, 'ch1')).toBeUndefined();
  });
});

describe('resolveDefaults', () => {
  it('returns chapter defaults when set', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');
    setChapterDefaults(db, {
      chapter_id: 'ch1',
      project_id: 'proj-def',
      default_grid_rows: 5,
      default_grid_cols: 12,
      require_playtest_pass: true,
    });

    const resolved = resolveDefaults(db, 'ch1');
    expect(resolved.grid_rows).toBe(5);
    expect(resolved.grid_cols).toBe(12);
    expect(resolved.require_playtest_pass).toBe(true);
  });

  it('returns system fallbacks when no defaults set', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');

    const resolved = resolveDefaults(db, 'ch1');
    expect(resolved.grid_rows).toBe(3);
    expect(resolved.grid_cols).toBe(8);
    expect(resolved.tile_size_px).toBe(64);
    expect(resolved.viewport_width).toBe(1280);
    expect(resolved.viewport_height).toBe(720);
    expect(resolved.require_scene_contract).toBe(true);
    expect(resolved.require_ui_layers).toBe(true);
    expect(resolved.require_proof_pass).toBe(true);
    expect(resolved.require_playtest_pass).toBe(false);
    expect(resolved.require_canon_link).toBe(false);
  });

  it('resolves boolean flags correctly', () => {
    seedProject();
    createChapter(db, 'proj-def', 'ch1', 'Chapter 1');
    setChapterDefaults(db, {
      chapter_id: 'ch1',
      project_id: 'proj-def',
      require_scene_contract: false,
      require_canon_link: true,
    });

    const resolved = resolveDefaults(db, 'ch1');
    expect(resolved.require_scene_contract).toBe(false);
    expect(resolved.require_canon_link).toBe(true);
  });
});
