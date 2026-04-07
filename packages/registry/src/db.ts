import Database from 'better-sqlite3';
import { migrate } from './schema.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const DEFAULT_DB_DIR = path.join(os.homedir(), '.game-foundry');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'registry.db');

export function getDbPath(): string {
  return process.env.FOUNDRY_REGISTRY_PATH || DEFAULT_DB_PATH;
}

export function openDatabase(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || getDbPath();

  // Ensure directory exists (unless in-memory)
  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(resolvedPath);
  migrate(db);
  return db;
}
