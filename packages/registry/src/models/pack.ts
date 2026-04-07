import type Database from 'better-sqlite3';
import type { AssetPackRow, PackType } from '../types.js';

export interface CreatePackInput {
  id: string;
  project_id: string;
  pack_type: PackType;
  chapter?: string;
  sprite_size?: number;
  directions?: number;
  root_path: string;
  manifest_path?: string;
}

export function upsertPack(db: Database.Database, input: CreatePackInput): AssetPackRow {
  db.prepare(`
    INSERT INTO asset_packs (id, project_id, pack_type, chapter, sprite_size, directions, root_path, manifest_path)
    VALUES (@id, @project_id, @pack_type, @chapter, @sprite_size, @directions, @root_path, @manifest_path)
    ON CONFLICT(id) DO UPDATE SET
      pack_type = excluded.pack_type,
      chapter = COALESCE(excluded.chapter, asset_packs.chapter),
      sprite_size = excluded.sprite_size,
      directions = excluded.directions,
      root_path = excluded.root_path,
      manifest_path = COALESCE(excluded.manifest_path, asset_packs.manifest_path),
      updated_at = datetime('now')
  `).run({
    id: input.id,
    project_id: input.project_id,
    pack_type: input.pack_type,
    chapter: input.chapter ?? null,
    sprite_size: input.sprite_size ?? 48,
    directions: input.directions ?? 8,
    root_path: input.root_path,
    manifest_path: input.manifest_path ?? null,
  });

  return db.prepare('SELECT * FROM asset_packs WHERE id = ?').get(input.id) as AssetPackRow;
}

export function getPack(db: Database.Database, id: string): AssetPackRow | undefined {
  return db.prepare('SELECT * FROM asset_packs WHERE id = ?').get(id) as AssetPackRow | undefined;
}

export function listPacks(db: Database.Database, projectId?: string): AssetPackRow[] {
  if (projectId) {
    return db.prepare('SELECT * FROM asset_packs WHERE project_id = ? ORDER BY chapter, id')
      .all(projectId) as AssetPackRow[];
  }
  return db.prepare('SELECT * FROM asset_packs ORDER BY chapter, id').all() as AssetPackRow[];
}

export function updatePackCounts(db: Database.Database, packId: string, memberCount: number, completeMembers: number): void {
  db.prepare(`
    UPDATE asset_packs SET member_count = ?, complete_members = ?, updated_at = datetime('now') WHERE id = ?
  `).run(memberCount, completeMembers, packId);
}
