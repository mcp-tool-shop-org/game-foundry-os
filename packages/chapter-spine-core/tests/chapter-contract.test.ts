import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import {
  createChapter,
  getChapter,
  listChapters,
  getChapterEncounters,
  transitionChapterState,
} from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-ch', 'Chapter Project', '/tmp/ch');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('createChapter', () => {
  it('creates chapter with correct fields', () => {
    seedProject();
    const ch = createChapter(db, 'proj-ch', 'ch1', 'Chapter 1: The Patrol Route');

    expect(ch.id).toBe('ch1');
    expect(ch.project_id).toBe('proj-ch');
    expect(ch.display_name).toBe('Chapter 1: The Patrol Route');
    expect(ch.production_state).toBe('draft');
  });

  it('accepts optional fields', () => {
    seedProject();
    const ch = createChapter(db, 'proj-ch', 'ch1', 'Chapter 1', {
      sort_order: 1,
      intent_summary: 'Introduce basic combat',
      required_encounter_count: 3,
      required_playtest_pass: true,
    });

    expect(ch.sort_order).toBe(1);
    expect(ch.intent_summary).toBe('Introduce basic combat');
    expect(ch.required_encounter_count).toBe(3);
    expect(ch.required_playtest_pass).toBe(1);
  });

  it('upserts on conflict', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Original');
    const updated = createChapter(db, 'proj-ch', 'ch1', 'Updated');

    expect(updated.display_name).toBe('Updated');
  });
});

describe('getChapter', () => {
  it('returns chapter by id', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Ch1');
    const ch = getChapter(db, 'ch1');

    expect(ch).toBeDefined();
    expect(ch!.id).toBe('ch1');
  });

  it('returns undefined for nonexistent', () => {
    expect(getChapter(db, 'nonexistent')).toBeUndefined();
  });
});

describe('listChapters', () => {
  it('returns chapters ordered by sort_order', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch2', 'Chapter 2', { sort_order: 2 });
    createChapter(db, 'proj-ch', 'ch1', 'Chapter 1', { sort_order: 1 });
    createChapter(db, 'proj-ch', 'ch3', 'Chapter 3', { sort_order: 3 });

    const chapters = listChapters(db, 'proj-ch');
    expect(chapters).toHaveLength(3);
    expect(chapters[0].id).toBe('ch1');
    expect(chapters[1].id).toBe('ch2');
    expect(chapters[2].id).toBe('ch3');
  });

  it('returns empty for project with no chapters', () => {
    seedProject();
    expect(listChapters(db, 'proj-ch')).toHaveLength(0);
  });
});

describe('getChapterEncounters', () => {
  it('returns encounters that belong to the chapter', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-ch', chapter: 'ch1', label: 'Ambush' });
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-ch', chapter: 'ch1', label: 'Patrol' });
    upsertEncounter(db, { id: 'enc3', project_id: 'proj-ch', chapter: 'ch2', label: 'Other Chapter' });

    const encounters = getChapterEncounters(db, 'ch1', 'proj-ch');
    expect(encounters).toHaveLength(2);
    expect(encounters.map(e => e.id)).toContain('enc1');
    expect(encounters.map(e => e.id)).toContain('enc2');
    expect(encounters.map(e => e.id)).not.toContain('enc3');
  });

  it('returns empty for chapter with no encounters', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Empty Chapter');
    expect(getChapterEncounters(db, 'ch1', 'proj-ch')).toHaveLength(0);
  });

  it('infers project_id from chapter record', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Chapter 1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-ch', chapter: 'ch1', label: 'Test' });

    const encounters = getChapterEncounters(db, 'ch1');
    expect(encounters).toHaveLength(1);
  });
});

describe('transitionChapterState', () => {
  it('transitions from draft to encounters_ready', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Ch1');
    transitionChapterState(db, 'ch1', 'encounters_ready', 'All encounters defined');

    const ch = getChapter(db, 'ch1');
    expect(ch!.production_state).toBe('encounters_ready');
  });

  it('emits state event', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Ch1');
    transitionChapterState(db, 'ch1', 'encounters_ready');

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'chapter' AND entity_id = 'ch1'"
    ).all() as any[];
    expect(events).toHaveLength(1);
    expect(events[0].from_state).toBe('draft');
    expect(events[0].to_state).toBe('encounters_ready');
  });

  it('rejects backward transitions', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Ch1');
    transitionChapterState(db, 'ch1', 'encounters_ready');
    expect(() => transitionChapterState(db, 'ch1', 'draft')).toThrow('Cannot transition');
  });

  it('supports full forward chain to frozen', () => {
    seedProject();
    createChapter(db, 'proj-ch', 'ch1', 'Ch1');
    const chain: Array<import('@mcptoolshop/game-foundry-registry').ChapterProductionState> = [
      'encounters_ready', 'scenes_ready', 'proof_passed', 'playtest_passed', 'frozen',
    ];
    for (const state of chain) {
      transitionChapterState(db, 'ch1', state);
    }
    expect(getChapter(db, 'ch1')!.production_state).toBe('frozen');
  });

  it('throws for nonexistent chapter', () => {
    expect(() => transitionChapterState(db, 'nonexistent', 'encounters_ready')).toThrow('Chapter not found');
  });
});
