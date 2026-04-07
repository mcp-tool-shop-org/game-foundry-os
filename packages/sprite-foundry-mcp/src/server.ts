import type Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetCharacterStatus } from './tools/getCharacterStatus.js';
import { registerListCharacters } from './tools/listCharacters.js';
import { registerRegisterCharacter } from './tools/registerCharacter.js';
import { registerRegisterVariant } from './tools/registerVariant.js';
import { registerSetProductionState } from './tools/setProductionState.js';
import { registerValidateCompleteness } from './tools/validateCompleteness.js';
import { registerGetPackManifest } from './tools/getPackManifest.js';
import { registerScanAssets } from './tools/scanAssets.js';

export function createServer(db: Database.Database): McpServer {
  const server = new McpServer({
    name: 'sprite-foundry-mcp',
    version: '0.1.0',
  });

  // Register all tools
  registerGetCharacterStatus(server, db);
  registerListCharacters(server, db);
  registerRegisterCharacter(server, db);
  registerRegisterVariant(server, db);
  registerSetProductionState(server, db);
  registerValidateCompleteness(server, db);
  registerGetPackManifest(server, db);
  registerScanAssets(server, db);

  return server;
}
