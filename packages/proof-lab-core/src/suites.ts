import type Database from 'better-sqlite3';
import type { ProofSuiteRow } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface CreateSuiteInput {
  project_id: string;
  suite_key: string;
  scope_type: string;
  display_name: string;
  description?: string;
  is_blocking?: boolean;
}

export function createSuite(db: Database.Database, input: CreateSuiteInput): ProofSuiteRow {
  const id = `suite_${crypto.randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO proof_suites (id, project_id, suite_key, scope_type, display_name, description, is_blocking)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.project_id,
    input.suite_key,
    input.scope_type,
    input.display_name,
    input.description ?? null,
    input.is_blocking !== false ? 1 : 0,
  );
  return db.prepare('SELECT * FROM proof_suites WHERE id = ?').get(id) as ProofSuiteRow;
}

export function getSuite(db: Database.Database, id: string): ProofSuiteRow | undefined {
  return db.prepare('SELECT * FROM proof_suites WHERE id = ?').get(id) as ProofSuiteRow | undefined;
}

export function listSuites(db: Database.Database, projectId: string, scopeType?: string): ProofSuiteRow[] {
  if (scopeType) {
    return db.prepare('SELECT * FROM proof_suites WHERE project_id = ? AND scope_type = ? ORDER BY suite_key')
      .all(projectId, scopeType) as ProofSuiteRow[];
  }
  return db.prepare('SELECT * FROM proof_suites WHERE project_id = ? ORDER BY suite_key')
    .all(projectId) as ProofSuiteRow[];
}
