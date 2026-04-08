import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter } from '@mcptoolshop/game-foundry-registry';
import { startPlaytest, completePlaytest, recordPlaytestFailures } from '@mcptoolshop/battle-scene-core';
import { createChapter, getChapterPlaytestStatus } from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() { upsertProject(db, 'proj-pt', 'PT Project', '/tmp/pt'); }

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('getChapterPlaytestStatus', () => {
  it('returns untested for chapter with no encounters', () => {
    seedProject();
    createChapter(db, 'proj-pt', 'ch1', 'Ch1');
    const status = getChapterPlaytestStatus(db, 'ch1');

    expect(status.overall_verdict).toBe('untested');
    expect(status.total_encounters).toBe(0);
  });

  it('returns incomplete when some encounters untested', () => {
    seedProject();
    createChapter(db, 'proj-pt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pt', chapter: 'ch1', label: 'Tested' });
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-pt', chapter: 'ch1', label: 'Untested' });
    const s = startPlaytest(db, 'proj-pt', 'enc1');
    completePlaytest(db, s.id, 'pass');

    const status = getChapterPlaytestStatus(db, 'ch1');
    expect(status.overall_verdict).toBe('incomplete');
    expect(status.untested_encounters).toContain('enc2');
    expect(status.passing_encounters).toContain('enc1');
  });

  it('returns pass when all encounters pass', () => {
    seedProject();
    createChapter(db, 'proj-pt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pt', chapter: 'ch1', label: 'A' });
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-pt', chapter: 'ch1', label: 'B' });
    const s1 = startPlaytest(db, 'proj-pt', 'enc1');
    completePlaytest(db, s1.id, 'pass');
    const s2 = startPlaytest(db, 'proj-pt', 'enc2');
    completePlaytest(db, s2.id, 'pass');

    const status = getChapterPlaytestStatus(db, 'ch1');
    expect(status.overall_verdict).toBe('pass');
    expect(status.tested_encounters).toBe(2);
  });

  it('fail verdict propagates from single encounter', () => {
    seedProject();
    createChapter(db, 'proj-pt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pt', chapter: 'ch1', label: 'Good' });
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-pt', chapter: 'ch1', label: 'Bad' });
    const s1 = startPlaytest(db, 'proj-pt', 'enc1');
    completePlaytest(db, s1.id, 'pass');
    const s2 = startPlaytest(db, 'proj-pt', 'enc2');
    recordPlaytestFailures(db, s2.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'Bad contrast' },
    ]);
    completePlaytest(db, s2.id, 'fail');

    const status = getChapterPlaytestStatus(db, 'ch1');
    expect(status.overall_verdict).toBe('fail');
    expect(status.failing_encounters).toContain('enc2');
    expect(status.total_read_failures).toBe(1);
  });

  it('marginal when no fails but some marginal', () => {
    seedProject();
    createChapter(db, 'proj-pt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pt', chapter: 'ch1', label: 'A' });
    const s = startPlaytest(db, 'proj-pt', 'enc1');
    completePlaytest(db, s.id, 'marginal');

    const status = getChapterPlaytestStatus(db, 'ch1');
    expect(status.overall_verdict).toBe('marginal');
    expect(status.marginal_encounters).toContain('enc1');
  });

  it('counts total read failures across encounters', () => {
    seedProject();
    createChapter(db, 'proj-pt', 'ch1', 'Ch1');
    upsertEncounter(db, { id: 'enc1', project_id: 'proj-pt', chapter: 'ch1', label: 'A' });
    upsertEncounter(db, { id: 'enc2', project_id: 'proj-pt', chapter: 'ch1', label: 'B' });
    const s1 = startPlaytest(db, 'proj-pt', 'enc1');
    recordPlaytestFailures(db, s1.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: '1' },
      { snapshot_key: 'threat_on', failure_type: 'threat_ambiguous', description: '2' },
    ]);
    completePlaytest(db, s1.id, 'marginal');
    const s2 = startPlaytest(db, 'proj-pt', 'enc2');
    recordPlaytestFailures(db, s2.id, [
      { snapshot_key: 'forecast', failure_type: 'forecast_missing', description: '3' },
    ]);
    completePlaytest(db, s2.id, 'marginal');

    const status = getChapterPlaytestStatus(db, 'ch1');
    expect(status.total_read_failures).toBe(3);
  });

  it('throws for nonexistent chapter', () => {
    expect(() => getChapterPlaytestStatus(db, 'nonexistent')).toThrow('Chapter not found');
  });
});
