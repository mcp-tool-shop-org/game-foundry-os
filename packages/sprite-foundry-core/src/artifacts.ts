import type Database from 'better-sqlite3';
import type { ArtifactRow, ArtifactType } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';
import fs from 'node:fs';

export interface RegisterArtifactInput {
  project_id: string;
  variant_id: string;
  artifact_type: ArtifactType;
  direction?: string;
  path: string;
  content_hash?: string;
  width?: number;
  height?: number;
  metadata_json?: string;
  is_canonical?: boolean;
}

export function registerArtifact(db: Database.Database, input: RegisterArtifactInput): ArtifactRow {
  const id = `art_${input.variant_id}_${input.artifact_type}_${input.direction ?? 'main'}_${Date.now().toString(36)}`;

  db.prepare(`
    INSERT INTO artifacts (id, project_id, variant_id, artifact_type, direction, path, content_hash, width, height, metadata_json, is_canonical)
    VALUES (@id, @project_id, @variant_id, @artifact_type, @direction, @path, @content_hash, @width, @height, @metadata_json, @is_canonical)
  `).run({
    id,
    project_id: input.project_id,
    variant_id: input.variant_id,
    artifact_type: input.artifact_type,
    direction: input.direction ?? null,
    path: input.path,
    content_hash: input.content_hash ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    metadata_json: input.metadata_json ?? null,
    is_canonical: input.is_canonical !== false ? 1 : 0,
  });

  return db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id) as ArtifactRow;
}

export function getArtifacts(
  db: Database.Database,
  variantId: string,
  artifactType?: ArtifactType,
): ArtifactRow[] {
  if (artifactType) {
    return db.prepare('SELECT * FROM artifacts WHERE variant_id = ? AND artifact_type = ? ORDER BY created_at')
      .all(variantId, artifactType) as ArtifactRow[];
  }
  return db.prepare('SELECT * FROM artifacts WHERE variant_id = ? ORDER BY artifact_type, created_at')
    .all(variantId) as ArtifactRow[];
}

export function getCanonicalArtifact(
  db: Database.Database,
  variantId: string,
  artifactType: ArtifactType,
  direction?: string,
): ArtifactRow | undefined {
  if (direction) {
    return db.prepare(
      'SELECT * FROM artifacts WHERE variant_id = ? AND artifact_type = ? AND direction = ? AND is_canonical = 1 ORDER BY created_at DESC LIMIT 1',
    ).get(variantId, artifactType, direction) as ArtifactRow | undefined;
  }
  return db.prepare(
    'SELECT * FROM artifacts WHERE variant_id = ? AND artifact_type = ? AND is_canonical = 1 ORDER BY created_at DESC LIMIT 1',
  ).get(variantId, artifactType) as ArtifactRow | undefined;
}

/** Compute SHA-256 hash of a file on disk */
export function computeFileHash(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}
