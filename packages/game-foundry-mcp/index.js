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

// Sprite Foundry workflow tools (Phase 1)
import { registerFoundryCreateVariant } from '../sprite-foundry-mcp/dist/tools/foundryCreateVariant.js';
import { registerFoundryStartConceptBatch } from '../sprite-foundry-mcp/dist/tools/foundryStartConceptBatch.js';
import { registerFoundryRecordConceptCandidates } from '../sprite-foundry-mcp/dist/tools/foundryRecordConceptCandidates.js';
import { registerFoundryLockConceptPick } from '../sprite-foundry-mcp/dist/tools/foundryLockConceptPick.js';
import { registerFoundryStartDirectionalBatch } from '../sprite-foundry-mcp/dist/tools/foundryStartDirectionalBatch.js';
import { registerFoundryLockDirectionalPick } from '../sprite-foundry-mcp/dist/tools/foundryLockDirectionalPick.js';
import { registerFoundryAssembleSheet } from '../sprite-foundry-mcp/dist/tools/foundryAssembleSheet.js';
import { registerFoundrySlicePack } from '../sprite-foundry-mcp/dist/tools/foundrySlicePack.js';
import { registerFoundryGetNextStep } from '../sprite-foundry-mcp/dist/tools/foundryGetNextStep.js';
import { registerFoundryGetCharacterTimeline } from '../sprite-foundry-mcp/dist/tools/foundryGetCharacterTimeline.js';
import { registerFoundrySyncPackToEngine } from '../sprite-foundry-mcp/dist/tools/foundrySyncPackToEngine.js';
import { registerFoundryAttachPortraitSet } from '../sprite-foundry-mcp/dist/tools/foundryAttachPortraitSet.js';

// Encounter Doctrine tools
import { setDb } from '../encounter-doctrine-mcp/dist/server.js';
import { registerValidateBounds } from '../encounter-doctrine-mcp/dist/tools/validateBounds.js';
import { registerValidateFormation } from '../encounter-doctrine-mcp/dist/tools/validateFormation.js';
import { registerValidateVariants } from '../encounter-doctrine-mcp/dist/tools/validateVariants.js';
import { registerListEncounters } from '../encounter-doctrine-mcp/dist/tools/listEncounters.js';
import { registerGetEncounter } from '../encounter-doctrine-mcp/dist/tools/getEncounter.js';
import { registerRegisterEncounter } from '../encounter-doctrine-mcp/dist/tools/registerEncounter.js';
import { registerExportManifest } from '../encounter-doctrine-mcp/dist/tools/exportManifest.js';

// Encounter Doctrine workflow tools (Phase 2)
import { registerDoctrineCreate } from '../encounter-doctrine-mcp/dist/tools/doctrineCreate.js';
import { registerDoctrineDefineIntent } from '../encounter-doctrine-mcp/dist/tools/doctrineDefineIntent.js';
import { registerDoctrineAddUnit } from '../encounter-doctrine-mcp/dist/tools/doctrineAddUnit.js';
import { registerDoctrineMoveUnit } from '../encounter-doctrine-mcp/dist/tools/doctrineMoveUnit.js';
import { registerDoctrineValidateStructural } from '../encounter-doctrine-mcp/dist/tools/doctrineValidateStructural.js';
import { registerDoctrineGetNextStep } from '../encounter-doctrine-mcp/dist/tools/doctrineGetNextStep.js';
import { registerDoctrineAttachRule } from '../encounter-doctrine-mcp/dist/tools/doctrineAttachRule.js';
import { registerDoctrineValidateDependencies } from '../encounter-doctrine-mcp/dist/tools/doctrineValidateDependencies.js';
import { registerDoctrineExportManifest } from '../encounter-doctrine-mcp/dist/tools/doctrineExportManifest.js';
import { registerDoctrineSyncToEngine } from '../encounter-doctrine-mcp/dist/tools/doctrineSyncToEngine.js';
import { registerDoctrineGetTimeline } from '../encounter-doctrine-mcp/dist/tools/doctrineGetTimeline.js';
import { registerDoctrineGetChapterMatrix } from '../encounter-doctrine-mcp/dist/tools/doctrineGetChapterMatrix.js';
import { registerDoctrineDiffRuntime } from '../encounter-doctrine-mcp/dist/tools/doctrineDiffRuntime.js';
import { registerDoctrineRemoveUnit } from '../encounter-doctrine-mcp/dist/tools/doctrineRemoveUnit.js';
import { registerDoctrineClone } from '../encounter-doctrine-mcp/dist/tools/doctrineClone.js';

// Engine Bridge tools
import { registerVerifyRuntimePaths } from '../engine-bridge-mcp/dist/tools/verifyRuntimePaths.js';
import { registerReportPlaceholders } from '../engine-bridge-mcp/dist/tools/reportPlaceholders.js';
import { registerReportUnintegrated } from '../engine-bridge-mcp/dist/tools/reportUnintegrated.js';
import { registerGetBattleRuntimeStatus } from '../engine-bridge-mcp/dist/tools/getBattleRuntimeStatus.js';
import { registerSyncSpritePack } from '../engine-bridge-mcp/dist/tools/syncSpritePack.js';
import { registerSyncEncounterManifests } from '../engine-bridge-mcp/dist/tools/syncEncounterManifests.js';

// ─── Single DB connection ───────────────────────────────────
const db = openDatabase();

// ─── Single MCP server, 48 tools ────────────────────────────
const server = new McpServer({
  name: 'game-foundry-mcp',
  version: '0.2.0',
});

// Sprite Foundry — inspection (8)
registerGetCharacterStatus(server, db);
registerListCharacters(server, db);
registerValidateCompleteness(server, db);
registerGetPackManifest(server, db);
registerScanAssets(server, db);
registerRegisterCharacter(server, db);
registerRegisterVariant(server, db);
registerSetProductionState(server, db);

// Sprite Foundry — workflow (12)
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

// Encounter Doctrine — inspection (7)
setDb(db);
registerValidateBounds(server);
registerValidateFormation(server);
registerValidateVariants(server);
registerListEncounters(server);
registerGetEncounter(server);
registerRegisterEncounter(server);
registerExportManifest(server);

// Encounter Doctrine — workflow (15)
registerDoctrineCreate(server);
registerDoctrineDefineIntent(server);
registerDoctrineAddUnit(server);
registerDoctrineMoveUnit(server);
registerDoctrineValidateStructural(server);
registerDoctrineGetNextStep(server);
registerDoctrineAttachRule(server);
registerDoctrineValidateDependencies(server);
registerDoctrineExportManifest(server);
registerDoctrineSyncToEngine(server);
registerDoctrineGetTimeline(server);
registerDoctrineGetChapterMatrix(server);
registerDoctrineDiffRuntime(server);
registerDoctrineRemoveUnit(server);
registerDoctrineClone(server);

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
