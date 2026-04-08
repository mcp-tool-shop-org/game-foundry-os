import type Database from 'better-sqlite3';
import type { CanonSnapshotRow } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface SnapshotComparisonResult {
  snapshot_a: { id: string; content_hash: string; created_at: string };
  snapshot_b: { id: string; content_hash: string; created_at: string };
  hashes_match: boolean;
  frontmatter_diff: {
    added_keys: string[];
    removed_keys: string[];
    changed_keys: string[];
  };
  body_changed: boolean;
}

export function createSnapshot(
  db: Database.Database,
  projectId: string,
  canonId: string,
  contentHash: string,
  parsedBody?: Record<string, unknown>,
): CanonSnapshotRow {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO canon_snapshots (id, project_id, canon_id, content_hash, parsed_body_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, projectId, canonId, contentHash, parsedBody ? JSON.stringify(parsedBody) : null);

  return db.prepare('SELECT * FROM canon_snapshots WHERE id = ?').get(id) as CanonSnapshotRow;
}

export function getSnapshots(db: Database.Database, canonId: string): CanonSnapshotRow[] {
  return db.prepare('SELECT * FROM canon_snapshots WHERE canon_id = ? ORDER BY created_at')
    .all(canonId) as CanonSnapshotRow[];
}

export function compareSnapshots(
  db: Database.Database,
  snapshotIdA: string,
  snapshotIdB: string,
): SnapshotComparisonResult | null {
  const a = db.prepare('SELECT * FROM canon_snapshots WHERE id = ?').get(snapshotIdA) as CanonSnapshotRow | undefined;
  const b = db.prepare('SELECT * FROM canon_snapshots WHERE id = ?').get(snapshotIdB) as CanonSnapshotRow | undefined;

  if (!a || !b) return null;

  const bodyA = a.parsed_body_json ? JSON.parse(a.parsed_body_json) : {};
  const bodyB = b.parsed_body_json ? JSON.parse(b.parsed_body_json) : {};

  const keysA = new Set(Object.keys(bodyA));
  const keysB = new Set(Object.keys(bodyB));

  const added_keys = [...keysB].filter((k) => !keysA.has(k));
  const removed_keys = [...keysA].filter((k) => !keysB.has(k));
  const changed_keys = [...keysA]
    .filter((k) => keysB.has(k))
    .filter((k) => JSON.stringify(bodyA[k]) !== JSON.stringify(bodyB[k]));

  return {
    snapshot_a: { id: a.id, content_hash: a.content_hash, created_at: a.created_at },
    snapshot_b: { id: b.id, content_hash: b.content_hash, created_at: b.created_at },
    hashes_match: a.content_hash === b.content_hash,
    frontmatter_diff: { added_keys, removed_keys, changed_keys },
    body_changed: a.content_hash !== b.content_hash,
  };
}
