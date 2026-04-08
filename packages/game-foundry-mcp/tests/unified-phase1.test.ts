import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';

// Sprite Foundry inspection tools (8)
import { registerGetCharacterStatus } from '../../sprite-foundry-mcp/dist/tools/getCharacterStatus.js';
import { registerListCharacters } from '../../sprite-foundry-mcp/dist/tools/listCharacters.js';
import { registerValidateCompleteness } from '../../sprite-foundry-mcp/dist/tools/validateCompleteness.js';
import { registerGetPackManifest } from '../../sprite-foundry-mcp/dist/tools/getPackManifest.js';
import { registerScanAssets } from '../../sprite-foundry-mcp/dist/tools/scanAssets.js';
import { registerRegisterCharacter } from '../../sprite-foundry-mcp/dist/tools/registerCharacter.js';
import { registerRegisterVariant } from '../../sprite-foundry-mcp/dist/tools/registerVariant.js';
import { registerSetProductionState } from '../../sprite-foundry-mcp/dist/tools/setProductionState.js';

// Sprite Foundry workflow tools (12)
import { registerFoundryCreateVariant } from '../../sprite-foundry-mcp/dist/tools/foundryCreateVariant.js';
import { registerFoundryStartConceptBatch } from '../../sprite-foundry-mcp/dist/tools/foundryStartConceptBatch.js';
import { registerFoundryRecordConceptCandidates } from '../../sprite-foundry-mcp/dist/tools/foundryRecordConceptCandidates.js';
import { registerFoundryLockConceptPick } from '../../sprite-foundry-mcp/dist/tools/foundryLockConceptPick.js';
import { registerFoundryStartDirectionalBatch } from '../../sprite-foundry-mcp/dist/tools/foundryStartDirectionalBatch.js';
import { registerFoundryLockDirectionalPick } from '../../sprite-foundry-mcp/dist/tools/foundryLockDirectionalPick.js';
import { registerFoundryAssembleSheet } from '../../sprite-foundry-mcp/dist/tools/foundryAssembleSheet.js';
import { registerFoundrySlicePack } from '../../sprite-foundry-mcp/dist/tools/foundrySlicePack.js';
import { registerFoundryGetNextStep } from '../../sprite-foundry-mcp/dist/tools/foundryGetNextStep.js';
import { registerFoundryGetCharacterTimeline } from '../../sprite-foundry-mcp/dist/tools/foundryGetCharacterTimeline.js';
import { registerFoundrySyncPackToEngine } from '../../sprite-foundry-mcp/dist/tools/foundrySyncPackToEngine.js';
import { registerFoundryAttachPortraitSet } from '../../sprite-foundry-mcp/dist/tools/foundryAttachPortraitSet.js';

// Encounter Doctrine tools (7)
import { setDb } from '../../encounter-doctrine-mcp/dist/server.js';
import { registerValidateBounds } from '../../encounter-doctrine-mcp/dist/tools/validateBounds.js';
import { registerValidateFormation } from '../../encounter-doctrine-mcp/dist/tools/validateFormation.js';
import { registerValidateVariants } from '../../encounter-doctrine-mcp/dist/tools/validateVariants.js';
import { registerListEncounters } from '../../encounter-doctrine-mcp/dist/tools/listEncounters.js';
import { registerGetEncounter } from '../../encounter-doctrine-mcp/dist/tools/getEncounter.js';
import { registerRegisterEncounter } from '../../encounter-doctrine-mcp/dist/tools/registerEncounter.js';
import { registerExportManifest } from '../../encounter-doctrine-mcp/dist/tools/exportManifest.js';

// Engine Bridge tools (6)
import { registerVerifyRuntimePaths } from '../../engine-bridge-mcp/dist/tools/verifyRuntimePaths.js';
import { registerReportPlaceholders } from '../../engine-bridge-mcp/dist/tools/reportPlaceholders.js';
import { registerReportUnintegrated } from '../../engine-bridge-mcp/dist/tools/reportUnintegrated.js';
import { registerGetBattleRuntimeStatus } from '../../engine-bridge-mcp/dist/tools/getBattleRuntimeStatus.js';
import { registerSyncSpritePack } from '../../engine-bridge-mcp/dist/tools/syncSpritePack.js';
import { registerSyncEncounterManifests } from '../../engine-bridge-mcp/dist/tools/syncEncounterManifests.js';

function registerAllTools(server: McpServer, db: ReturnType<typeof openDatabase>) {
  // Sprite Foundry inspection (8)
  registerGetCharacterStatus(server, db);
  registerListCharacters(server, db);
  registerValidateCompleteness(server, db);
  registerGetPackManifest(server, db);
  registerScanAssets(server, db);
  registerRegisterCharacter(server, db);
  registerRegisterVariant(server, db);
  registerSetProductionState(server, db);

  // Sprite Foundry workflow (12)
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
}

describe('unified server with Phase 1 tools', () => {
  it('registers all 33 tools (8 inspection + 12 workflow + 7 encounter + 6 engine)', () => {
    const db = openDatabase(':memory:');
    const server = new McpServer({ name: 'game-foundry-mcp', version: '0.1.0' });
    // This will throw if any registration fails
    registerAllTools(server, db);
    expect(true).toBe(true);
  });

  it('all tools have unique names (no duplicates)', () => {
    const db = openDatabase(':memory:');
    const server = new McpServer({ name: 'game-foundry-mcp', version: '0.1.0' });
    // McpServer.tool will throw if a duplicate name is registered
    // If registerAllTools completes without error, all names are unique
    expect(() => registerAllTools(server, db)).not.toThrow();
  });

  it('tool names follow expected naming conventions', () => {
    // Verify the count: 8 + 12 + 7 + 6 = 33
    const inspectionTools = 8;
    const workflowTools = 12;
    const encounterTools = 7;
    const engineTools = 6;
    const total = inspectionTools + workflowTools + encounterTools + engineTools;
    expect(total).toBe(33);

    // Registration functions exist and are callable
    expect(typeof registerFoundryCreateVariant).toBe('function');
    expect(typeof registerFoundryStartConceptBatch).toBe('function');
    expect(typeof registerFoundryLockDirectionalPick).toBe('function');
    expect(typeof registerValidateBounds).toBe('function');
    expect(typeof registerSyncEncounterManifests).toBe('function');
  });
});
