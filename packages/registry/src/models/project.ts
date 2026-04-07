import type Database from 'better-sqlite3';
import type { ProjectRow } from '../types.js';

export function upsertProject(db: Database.Database, id: string, displayName: string, rootPath: string): ProjectRow {
  db.prepare(`
    INSERT INTO projects (id, display_name, root_path)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      root_path = excluded.root_path,
      updated_at = datetime('now')
  `).run(id, displayName, rootPath);

  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow;
}

export function getProject(db: Database.Database, id: string): ProjectRow | undefined {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
}

export function listProjects(db: Database.Database): ProjectRow[] {
  return db.prepare('SELECT * FROM projects ORDER BY display_name').all() as ProjectRow[];
}
