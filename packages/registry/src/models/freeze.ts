import type Database from 'better-sqlite3';
import type { FreezeLogRow } from '../types.js';

export function addFreezeEntry(
  db: Database.Database,
  objectType: string,
  objectId: string,
  contentHash?: string,
  frozenBy?: string,
  notes?: string
): FreezeLogRow {
  const result = db.prepare(`
    INSERT INTO freeze_log (object_type, object_id, content_hash, frozen_by, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(objectType, objectId, contentHash ?? null, frozenBy ?? null, notes ?? null);

  return db.prepare('SELECT * FROM freeze_log WHERE id = ?')
    .get(result.lastInsertRowid) as FreezeLogRow;
}

export function getFreezeHistory(db: Database.Database, objectType: string, objectId: string): FreezeLogRow[] {
  return db.prepare(
    'SELECT * FROM freeze_log WHERE object_type = ? AND object_id = ? ORDER BY frozen_at DESC'
  ).all(objectType, objectId) as FreezeLogRow[];
}

export function getLatestFreeze(db: Database.Database, objectType: string, objectId: string): FreezeLogRow | undefined {
  return db.prepare(
    'SELECT * FROM freeze_log WHERE object_type = ? AND object_id = ? ORDER BY frozen_at DESC LIMIT 1'
  ).get(objectType, objectId) as FreezeLogRow | undefined;
}
