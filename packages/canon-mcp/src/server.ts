import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

import { registerCanonSyncVault } from './tools/canonSyncVault.js';
import { registerCanonGetPage } from './tools/canonGetPage.js';
import { registerCanonSearch } from './tools/canonSearch.js';
import { registerCanonLinkObject } from './tools/canonLinkObject.js';
import { registerCanonGetCharacterBible } from './tools/canonGetCharacterBible.js';
import { registerCanonGetEncounterIntent } from './tools/canonGetEncounterIntent.js';
import { registerCanonDiffVsProduction } from './tools/canonDiffVsProduction.js';
import { registerCanonGetFreezeNote } from './tools/canonGetFreezeNote.js';
import { registerCanonGenerateHandoff } from './tools/canonGenerateHandoff.js';
import { registerCanonGetTimeline } from './tools/canonGetTimeline.js';
import { registerCanonValidatePages } from './tools/canonValidatePages.js';
import { registerCanonGetNextStep } from './tools/canonGetNextStep.js';
import { registerCanonCreatePageStub } from './tools/canonCreatePageStub.js';
import { registerCanonCompareSnapshots } from './tools/canonCompareSnapshots.js';
import { registerCanonGetProjectMatrix } from './tools/canonGetProjectMatrix.js';

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
    name: 'canon-mcp',
    version: '0.1.0',
  });

  registerCanonSyncVault(server);
  registerCanonGetPage(server);
  registerCanonSearch(server);
  registerCanonLinkObject(server);
  registerCanonGetCharacterBible(server);
  registerCanonGetEncounterIntent(server);
  registerCanonDiffVsProduction(server);
  registerCanonGetFreezeNote(server);
  registerCanonGenerateHandoff(server);
  registerCanonGetTimeline(server);
  registerCanonValidatePages(server);
  registerCanonGetNextStep(server);
  registerCanonCreatePageStub(server);
  registerCanonCompareSnapshots(server);
  registerCanonGetProjectMatrix(server);

  return server;
}
