import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { registerVerifyRuntimePaths } from './tools/verifyRuntimePaths.js';
import { registerReportPlaceholders } from './tools/reportPlaceholders.js';
import { registerReportUnintegrated } from './tools/reportUnintegrated.js';
import { registerGetBattleRuntimeStatus } from './tools/getBattleRuntimeStatus.js';
import { registerSyncSpritePack } from './tools/syncSpritePack.js';
import { registerSyncEncounterManifests } from './tools/syncEncounterManifests.js';
import { registerInspectProject } from './tools/inspectProject.js';
import { registerSceneGraph } from './tools/sceneGraph.js';
import { registerTemplateShellVerify } from './tools/templateShellVerify.js';
import { registerResourceUidAudit } from './tools/resourceUidAudit.js';
import { registerAutoloadContract } from './tools/autoloadContract.js';
import { registerSignalContractAudit } from './tools/signalContractAudit.js';
import { registerExportAudit } from './tools/exportAudit.js';
import { registerAssetImportAudit } from './tools/assetImportAudit.js';

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

  // Godot truth reader tools
  registerInspectProject(server, db);
  registerSceneGraph(server, db);
  registerTemplateShellVerify(server, db);
  registerResourceUidAudit(server, db);
  registerAutoloadContract(server, db);
  registerSignalContractAudit(server, db);
  registerExportAudit(server, db);
  registerAssetImportAudit(server, db);

  // Mutating tools
  registerSyncSpritePack(server, db);
  registerSyncEncounterManifests(server, db);

  return server;
}
