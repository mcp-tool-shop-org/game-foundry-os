import type Database from 'better-sqlite3';
import type { CanonLinkRow } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface LinkObjectInput {
  project_id: string;
  source_canon_id: string;
  target_type: string;
  target_id: string;
  link_type: string;
}

export function linkObject(db: Database.Database, input: LinkObjectInput): CanonLinkRow {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO canon_links (id, project_id, source_canon_id, target_type, target_id, link_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, input.project_id, input.source_canon_id, input.target_type, input.target_id, input.link_type);

  // Update page status to linked if currently registered
  db.prepare(`
    UPDATE canon_pages SET status = 'linked', updated_at = datetime('now')
    WHERE canon_id = ? AND status = 'registered'
  `).run(input.source_canon_id);

  return db.prepare('SELECT * FROM canon_links WHERE id = ?').get(id) as CanonLinkRow;
}

export function getLinks(db: Database.Database, canonId: string): CanonLinkRow[] {
  return db.prepare('SELECT * FROM canon_links WHERE source_canon_id = ? ORDER BY created_at')
    .all(canonId) as CanonLinkRow[];
}

export function getLinksTo(db: Database.Database, targetType: string, targetId: string): CanonLinkRow[] {
  return db.prepare('SELECT * FROM canon_links WHERE target_type = ? AND target_id = ? ORDER BY created_at')
    .all(targetType, targetId) as CanonLinkRow[];
}

export function unlinkObject(db: Database.Database, linkId: string): void {
  db.prepare('DELETE FROM canon_links WHERE id = ?').run(linkId);
}
