import type Database from 'better-sqlite3';
import type { ProjectBootstrapRow, BootstrapArtifactRow, BootstrapMode, BootstrapResult } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export function createBootstrap(
  db: Database.Database,
  projectId: string,
  templateId: string | null,
  mode: BootstrapMode,
  targetPath: string,
): ProjectBootstrapRow {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO project_bootstraps (id, project_id, template_id, bootstrap_mode, target_path, result)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(id, projectId, templateId, mode, targetPath);

  return db.prepare('SELECT * FROM project_bootstraps WHERE id = ?').get(id) as ProjectBootstrapRow;
}

export function completeBootstrap(
  db: Database.Database,
  bootstrapId: string,
  result: BootstrapResult,
  detailsJson?: string,
  receiptHash?: string,
): ProjectBootstrapRow {
  db.prepare(`
    UPDATE project_bootstraps
    SET result = ?, details_json = ?, receipt_hash = ?
    WHERE id = ?
  `).run(result, detailsJson ?? null, receiptHash ?? null, bootstrapId);

  return db.prepare('SELECT * FROM project_bootstraps WHERE id = ?').get(bootstrapId) as ProjectBootstrapRow;
}

export function getBootstrap(db: Database.Database, bootstrapId: string): ProjectBootstrapRow | undefined {
  return db.prepare('SELECT * FROM project_bootstraps WHERE id = ?').get(bootstrapId) as ProjectBootstrapRow | undefined;
}

export function getLatestBootstrap(db: Database.Database, projectId: string): ProjectBootstrapRow | undefined {
  return db.prepare(
    'SELECT * FROM project_bootstraps WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(projectId) as ProjectBootstrapRow | undefined;
}

export function addBootstrapArtifact(
  db: Database.Database,
  bootstrapId: string,
  artifactType: string,
  path: string,
  contentHash?: string,
): BootstrapArtifactRow {
  const info = db.prepare(`
    INSERT INTO bootstrap_artifacts (project_bootstrap_id, artifact_type, path, content_hash)
    VALUES (?, ?, ?, ?)
  `).run(bootstrapId, artifactType, path, contentHash ?? null);

  return db.prepare('SELECT * FROM bootstrap_artifacts WHERE id = ?').get(info.lastInsertRowid) as BootstrapArtifactRow;
}

export function getBootstrapArtifacts(db: Database.Database, bootstrapId: string): BootstrapArtifactRow[] {
  return db.prepare(
    'SELECT * FROM bootstrap_artifacts WHERE project_bootstrap_id = ? ORDER BY id'
  ).all(bootstrapId) as BootstrapArtifactRow[];
}
