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

// Foundry workflow tools
import { registerFoundryCreateVariant } from './tools/foundryCreateVariant.js';
import { registerFoundryStartConceptBatch } from './tools/foundryStartConceptBatch.js';
import { registerFoundryRecordConceptCandidates } from './tools/foundryRecordConceptCandidates.js';
import { registerFoundryLockConceptPick } from './tools/foundryLockConceptPick.js';
import { registerFoundryStartDirectionalBatch } from './tools/foundryStartDirectionalBatch.js';
import { registerFoundryLockDirectionalPick } from './tools/foundryLockDirectionalPick.js';
import { registerFoundryAssembleSheet } from './tools/foundryAssembleSheet.js';
import { registerFoundrySlicePack } from './tools/foundrySlicePack.js';
import { registerFoundryGetNextStep } from './tools/foundryGetNextStep.js';
import { registerFoundryGetCharacterTimeline } from './tools/foundryGetCharacterTimeline.js';
import { registerFoundrySyncPackToEngine } from './tools/foundrySyncPackToEngine.js';
import { registerFoundryAttachPortraitSet } from './tools/foundryAttachPortraitSet.js';

export function createServer(db: Database.Database): McpServer {
  const server = new McpServer({
    name: 'sprite-foundry-mcp',
    version: '0.1.0',
  });

  // Register existing tools
  registerGetCharacterStatus(server, db);
  registerListCharacters(server, db);
  registerRegisterCharacter(server, db);
  registerRegisterVariant(server, db);
  registerSetProductionState(server, db);
  registerValidateCompleteness(server, db);
  registerGetPackManifest(server, db);
  registerScanAssets(server, db);

  // Register foundry workflow tools
  registerFoundryCreateVariant(server, db);
  registerFoundryStartConceptBatch(server, db);
  registerFoundryRecordConceptCandidates(server, db);
  registerFoundryLockConceptPick(server, db);
  registerFoundryStartDirectionalBatch(server, db);
  registerFoundryLockDirectionalPick(server, db);
  registerFoundryAssembleSheet(server, db);
  registerFoundrySlicePack(server, db);
  registerFoundryGetNextStep(server, db);
  registerFoundryGetCharacterTimeline(server, db);
  registerFoundrySyncPackToEngine(server, db);
  registerFoundryAttachPortraitSet(server, db);

  return server;
}
