import type Database from 'better-sqlite3';
import { seedProjectRegistry } from './seed-registry.js';

export interface InstallProofResult {
  suites_created: number;
  policies_created: number;
}

export function installProofShell(
  db: Database.Database,
  projectId: string,
): InstallProofResult {
  const result = seedProjectRegistry(db, projectId, 'godot-tactics-template');
  return {
    suites_created: result.suites_created,
    policies_created: result.policies_created,
  };
}
