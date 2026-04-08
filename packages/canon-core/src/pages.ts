import type Database from 'better-sqlite3';
import type { CanonPageRow } from '@mcptoolshop/game-foundry-registry';

export function getPage(db: Database.Database, canonId: string): CanonPageRow | undefined {
  return db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?').get(canonId) as CanonPageRow | undefined;
}

export function getPageById(db: Database.Database, id: string): CanonPageRow | undefined {
  return db.prepare('SELECT * FROM canon_pages WHERE id = ?').get(id) as CanonPageRow | undefined;
}

export function listPages(
  db: Database.Database,
  projectId: string,
  filters?: { kind?: string; status?: string },
): CanonPageRow[] {
  let query = 'SELECT * FROM canon_pages WHERE project_id = @project_id';
  const params: Record<string, string> = { project_id: projectId };

  if (filters?.kind) {
    query += ' AND kind = @kind';
    params.kind = filters.kind;
  }
  if (filters?.status) {
    query += ' AND status = @status';
    params.status = filters.status;
  }

  query += ' ORDER BY kind, title';
  return db.prepare(query).all(params) as CanonPageRow[];
}

export function updatePageStatus(db: Database.Database, canonId: string, status: string): void {
  db.prepare(`
    UPDATE canon_pages SET status = ?, updated_at = datetime('now') WHERE canon_id = ?
  `).run(status, canonId);
}

export function searchPages(
  db: Database.Database,
  projectId: string,
  query: string,
  filters?: { kind?: string; status?: string },
): CanonPageRow[] {
  const searchPattern = `%${query}%`;
  let sql = `
    SELECT * FROM canon_pages
    WHERE project_id = @project_id
      AND (title LIKE @search OR vault_path LIKE @search OR frontmatter_json LIKE @search)
  `;
  const params: Record<string, string> = {
    project_id: projectId,
    search: searchPattern,
  };

  if (filters?.kind) {
    sql += ' AND kind = @kind';
    params.kind = filters.kind;
  }
  if (filters?.status) {
    sql += ' AND status = @status';
    params.status = filters.status;
  }

  sql += ' ORDER BY kind, title';
  return db.prepare(sql).all(params) as CanonPageRow[];
}
