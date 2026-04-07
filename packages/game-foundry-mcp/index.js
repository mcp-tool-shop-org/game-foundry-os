#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';

// Sprite Foundry tools
import { registerGetCharacterStatus } from '../sprite-foundry-mcp/dist/tools/getCharacterStatus.js';
import { registerListCharacters } from '../sprite-foundry-mcp/dist/tools/listCharacters.js';
import { registerValidateCompleteness } from '../sprite-foundry-mcp/dist/tools/validateCompleteness.js';
import { registerGetPackManifest } from '../sprite-foundry-mcp/dist/tools/getPackManifest.js';
import { registerScanAssets } from '../sprite-foundry-mcp/dist/tools/scanAssets.js';
import { registerRegisterCharacter } from '../sprite-foundry-mcp/dist/tools/registerCharacter.js';
import { registerRegisterVariant } from '../sprite-foundry-mcp/dist/tools/registerVariant.js';
import { registerSetProductionState } from '../sprite-foundry-mcp/dist/tools/setProductionState.js';

// Encounter Doctrine tools
import { setDb } from '../encounter-doctrine-mcp/dist/server.js';
import { registerValidateBounds } from '../encounter-doctrine-mcp/dist/tools/validateBounds.js';
import { registerValidateFormation } from '../encounter-doctrine-mcp/dist/tools/validateFormation.js';
import { registerValidateVariants } from '../encounter-doctrine-mcp/dist/tools/validateVariants.js';
import { registerListEncounters } from '../encounter-doctrine-mcp/dist/tools/listEncounters.js';
import { registerGetEncounter } from '../encounter-doctrine-mcp/dist/tools/getEncounter.js';
import { registerRegisterEncounter } from '../encounter-doctrine-mcp/dist/tools/registerEncounter.js';
import { registerExportManifest } from '../encounter-doctrine-mcp/dist/tools/exportManifest.js';

// Engine Bridge tools
import { registerVerifyRuntimePaths } from '../engine-bridge-mcp/dist/tools/verifyRuntimePaths.js';
import { registerReportPlaceholders } from '../engine-bridge-mcp/dist/tools/reportPlaceholders.js';
import { registerReportUnintegrated } from '../engine-bridge-mcp/dist/tools/reportUnintegrated.js';
import { registerGetBattleRuntimeStatus } from '../engine-bridge-mcp/dist/tools/getBattleRuntimeStatus.js';
import { registerSyncSpritePack } from '../engine-bridge-mcp/dist/tools/syncSpritePack.js';
import { registerSyncEncounterManifests } from '../engine-bridge-mcp/dist/tools/syncEncounterManifests.js';

// ─── Single DB connection ───────────────────────────────────
const db = openDatabase();

// ─── Single MCP server, 21 tools ────────────────────────────
const server = new McpServer({
  name: 'game-foundry-mcp',
  version: '0.1.0',
});

// Sprite Foundry (8)
registerGetCharacterStatus(server, db);
registerListCharacters(server, db);
registerValidateCompleteness(server, db);
registerGetPackManifest(server, db);
registerScanAssets(server, db);
registerRegisterCharacter(server, db);
registerRegisterVariant(server, db);
registerSetProductionState(server, db);

// Encounter Doctrine (7)
setDb(db);
registerValidateBounds(server);
registerValidateFormation(server);
registerValidateVariants(server);
registerListEncounters(server);
registerGetEncounter(server);
registerRegisterEncounter(server);
registerExportManifest(server);

// Engine Bridge (6)
registerVerifyRuntimePaths(server, db);
registerReportPlaceholders(server, db);
registerReportUnintegrated(server, db);
registerGetBattleRuntimeStatus(server, db);
registerSyncSpritePack(server, db);
registerSyncEncounterManifests(server, db);

// ─── Connect ────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
