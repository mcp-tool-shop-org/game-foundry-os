import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../src/db.js';
import { addFreezeEntry, getFreezeHistory, getLatestFreeze } from '../src/models/freeze.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

describe('freeze model', () => {
  it('getLatestFreeze returns most recent entry', () => {
    // Insert two entries then manually backdate the first one so ORDER BY frozen_at DESC is deterministic
    const first = addFreezeEntry(db, 'chapter', 'ch1', 'hash-old', 'user-a', 'First freeze');
    db.prepare("UPDATE freeze_log SET frozen_at = datetime('now', '-1 hour') WHERE id = ?").run(first.id);
    addFreezeEntry(db, 'chapter', 'ch1', 'hash-new', 'user-b', 'Second freeze');

    const latest = getLatestFreeze(db, 'chapter', 'ch1');
    expect(latest).toBeDefined();
    expect(latest!.content_hash).toBe('hash-new');
    expect(latest!.frozen_by).toBe('user-b');
  });

  it('getLatestFreeze returns undefined when no entries', () => {
    const latest = getLatestFreeze(db, 'chapter', 'ch99');
    expect(latest).toBeUndefined();
  });

  it('freeze entries are ordered by frozen_at DESC in getFreezeHistory', () => {
    const e1 = addFreezeEntry(db, 'encounter', 'enc1', 'h1', 'alice');
    const e2 = addFreezeEntry(db, 'encounter', 'enc1', 'h2', 'bob');
    const e3 = addFreezeEntry(db, 'encounter', 'enc1', 'h3', 'charlie');

    // Backdate so ordering is deterministic: alice oldest, charlie newest
    db.prepare("UPDATE freeze_log SET frozen_at = datetime('now', '-2 hours') WHERE id = ?").run(e1.id);
    db.prepare("UPDATE freeze_log SET frozen_at = datetime('now', '-1 hour') WHERE id = ?").run(e2.id);

    const history = getFreezeHistory(db, 'encounter', 'enc1');
    expect(history).toHaveLength(3);
    // Most recent first
    expect(history[0].frozen_by).toBe('charlie');
    expect(history[2].frozen_by).toBe('alice');
  });
});
