import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

// Phase 1 tools
import { registerValidateBounds } from './tools/validateBounds.js';
import { registerValidateFormation } from './tools/validateFormation.js';
import { registerValidateVariants } from './tools/validateVariants.js';
import { registerListEncounters } from './tools/listEncounters.js';
import { registerGetEncounter } from './tools/getEncounter.js';
import { registerRegisterEncounter } from './tools/registerEncounter.js';
import { registerExportManifest } from './tools/exportManifest.js';

// Phase 2 tools — Cut 2A (authoring)
import { registerDoctrineCreate } from './tools/doctrineCreate.js';
import { registerDoctrineDefineIntent } from './tools/doctrineDefineIntent.js';
import { registerDoctrineAddUnit } from './tools/doctrineAddUnit.js';
import { registerDoctrineMoveUnit } from './tools/doctrineMoveUnit.js';
import { registerDoctrineValidateStructural } from './tools/doctrineValidateStructural.js';
import { registerDoctrineGetNextStep } from './tools/doctrineGetNextStep.js';

// Phase 2 tools — Cut 2B (rules + export + sync)
import { registerDoctrineAttachRule } from './tools/doctrineAttachRule.js';
import { registerDoctrineValidateDependencies } from './tools/doctrineValidateDependencies.js';
import { registerDoctrineExportManifest } from './tools/doctrineExportManifest.js';
import { registerDoctrineSyncToEngine } from './tools/doctrineSyncToEngine.js';
import { registerDoctrineGetTimeline } from './tools/doctrineGetTimeline.js';
import { registerDoctrineGetChapterMatrix } from './tools/doctrineGetChapterMatrix.js';

// Phase 2 tools — Cut 2C (diff + editing)
import { registerDoctrineDiffRuntime } from './tools/doctrineDiffRuntime.js';
import { registerDoctrineRemoveUnit } from './tools/doctrineRemoveUnit.js';
import { registerDoctrineClone } from './tools/doctrineClone.js';

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
    version: '0.2.0',
  });

  // Phase 1 tools
  registerValidateBounds(server);
  registerValidateFormation(server);
  registerValidateVariants(server);
  registerListEncounters(server);
  registerGetEncounter(server);
  registerRegisterEncounter(server);
  registerExportManifest(server);

  // Phase 2 — Cut 2A (authoring)
  registerDoctrineCreate(server);
  registerDoctrineDefineIntent(server);
  registerDoctrineAddUnit(server);
  registerDoctrineMoveUnit(server);
  registerDoctrineValidateStructural(server);
  registerDoctrineGetNextStep(server);

  // Phase 2 — Cut 2B (rules + export + sync)
  registerDoctrineAttachRule(server);
  registerDoctrineValidateDependencies(server);
  registerDoctrineExportManifest(server);
  registerDoctrineSyncToEngine(server);
  registerDoctrineGetTimeline(server);
  registerDoctrineGetChapterMatrix(server);

  // Phase 2 — Cut 2C (diff + editing)
  registerDoctrineDiffRuntime(server);
  registerDoctrineRemoveUnit(server);
  registerDoctrineClone(server);

  return server;
}
