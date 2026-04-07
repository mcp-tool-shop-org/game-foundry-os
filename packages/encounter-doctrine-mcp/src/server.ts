import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

import { registerValidateBounds } from './tools/validateBounds.js';
import { registerValidateFormation } from './tools/validateFormation.js';
import { registerValidateVariants } from './tools/validateVariants.js';
import { registerListEncounters } from './tools/listEncounters.js';
import { registerGetEncounter } from './tools/getEncounter.js';
import { registerRegisterEncounter } from './tools/registerEncounter.js';
import { registerExportManifest } from './tools/exportManifest.js';

let _db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!_db) {
    _db = openDatabase();
  }
  return _db;
}

/** Allow tests to inject an in-memory database */
export function setDb(db: Database.Database): void {
  _db = db;
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'encounter-doctrine-mcp',
    version: '0.1.0',
  });

  registerValidateBounds(server);
  registerValidateFormation(server);
  registerValidateVariants(server);
  registerListEncounters(server);
  registerGetEncounter(server);
  registerRegisterEncounter(server);
  registerExportManifest(server);

  return server;
}
