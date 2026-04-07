import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { registerVerifyRuntimePaths } from './tools/verifyRuntimePaths.js';
import { registerReportPlaceholders } from './tools/reportPlaceholders.js';
import { registerReportUnintegrated } from './tools/reportUnintegrated.js';
import { registerGetBattleRuntimeStatus } from './tools/getBattleRuntimeStatus.js';
import { registerSyncSpritePack } from './tools/syncSpritePack.js';
import { registerSyncEncounterManifests } from './tools/syncEncounterManifests.js';

export function createServer(db: Database.Database): McpServer {
  const server = new McpServer({
    name: 'engine-bridge-mcp',
    version: '0.1.0',
  });

  // Read-only tools
  registerVerifyRuntimePaths(server, db);
  registerReportPlaceholders(server, db);
  registerReportUnintegrated(server, db);
  registerGetBattleRuntimeStatus(server, db);

  // Mutating tools
  registerSyncSpritePack(server, db);
  registerSyncEncounterManifests(server, db);

  return server;
}
