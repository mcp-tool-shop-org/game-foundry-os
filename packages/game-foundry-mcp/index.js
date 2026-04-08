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

// Canon Layer tools (Phase 4)
import { setDb as setCanonDb } from '../canon-mcp/dist/server.js';
import { registerCanonSyncVault } from '../canon-mcp/dist/tools/canonSyncVault.js';
import { registerCanonGetPage } from '../canon-mcp/dist/tools/canonGetPage.js';
import { registerCanonSearch } from '../canon-mcp/dist/tools/canonSearch.js';
import { registerCanonLinkObject } from '../canon-mcp/dist/tools/canonLinkObject.js';
import { registerCanonGetCharacterBible } from '../canon-mcp/dist/tools/canonGetCharacterBible.js';
import { registerCanonGetEncounterIntent } from '../canon-mcp/dist/tools/canonGetEncounterIntent.js';
import { registerCanonDiffVsProduction } from '../canon-mcp/dist/tools/canonDiffVsProduction.js';
import { registerCanonGetFreezeNote } from '../canon-mcp/dist/tools/canonGetFreezeNote.js';
import { registerCanonGenerateHandoff } from '../canon-mcp/dist/tools/canonGenerateHandoff.js';
import { registerCanonGetTimeline } from '../canon-mcp/dist/tools/canonGetTimeline.js';
import { registerCanonValidatePages } from '../canon-mcp/dist/tools/canonValidatePages.js';
import { registerCanonGetNextStep } from '../canon-mcp/dist/tools/canonGetNextStep.js';
import { registerCanonCreatePageStub } from '../canon-mcp/dist/tools/canonCreatePageStub.js';
import { registerCanonCompareSnapshots } from '../canon-mcp/dist/tools/canonCompareSnapshots.js';
import { registerCanonGetProjectMatrix } from '../canon-mcp/dist/tools/canonGetProjectMatrix.js';

// Proof Lab tools (Phase 3)
import { setDb as setProofDb } from '../proof-lab-mcp/dist/server.js';
import { registerProofRunAssetSuite } from '../proof-lab-mcp/dist/tools/proofRunAssetSuite.js';
import { registerProofRunEncounterSuite } from '../proof-lab-mcp/dist/tools/proofRunEncounterSuite.js';
import { registerProofRunRuntimeSuite } from '../proof-lab-mcp/dist/tools/proofRunRuntimeSuite.js';
import { registerProofRunChapterSpine } from '../proof-lab-mcp/dist/tools/proofRunChapterSpine.js';
import { registerProofRunPresentationSuite } from '../proof-lab-mcp/dist/tools/proofRunPresentationSuite.js';
import { registerProofGetFreezeReadiness } from '../proof-lab-mcp/dist/tools/proofGetFreezeReadiness.js';
import { registerProofFreezeCandidate } from '../proof-lab-mcp/dist/tools/proofFreezeCandidate.js';
import { registerProofPromoteFreeze } from '../proof-lab-mcp/dist/tools/proofPromoteFreeze.js';
import { registerProofReportRegressions } from '../proof-lab-mcp/dist/tools/proofReportRegressions.js';
import { registerProofGetTimeline } from '../proof-lab-mcp/dist/tools/proofGetTimeline.js';
import { registerProofGenerateFreezeReport } from '../proof-lab-mcp/dist/tools/proofGenerateFreezeReport.js';
import { registerProofGetNextStep } from '../proof-lab-mcp/dist/tools/proofGetNextStep.js';
import { registerProofRevokeFreeze } from '../proof-lab-mcp/dist/tools/proofRevokeFreeze.js';
import { registerProofCompareRuns } from '../proof-lab-mcp/dist/tools/proofCompareRuns.js';
import { registerProofGetProjectMatrix } from '../proof-lab-mcp/dist/tools/proofGetProjectMatrix.js';
import { registerProofRunVisualSuite } from '../proof-lab-mcp/dist/tools/proofRunVisualSuite.js';

// Studio Bootstrap tools (Phase 5)
import { setDb as setStudioDb } from '../studio-mcp/dist/server.js';
import { registerStudioCreateProject } from '../studio-mcp/dist/tools/studioCreateProject.js';
import { registerStudioBootstrapTemplate } from '../studio-mcp/dist/tools/studioBootstrapTemplate.js';
import { registerStudioSeedRegistry } from '../studio-mcp/dist/tools/studioSeedRegistry.js';
import { registerStudioSeedVault } from '../studio-mcp/dist/tools/studioSeedVault.js';
import { registerStudioInstallRuntimeShell } from '../studio-mcp/dist/tools/studioInstallRuntimeShell.js';
import { registerStudioInstallThemeShell } from '../studio-mcp/dist/tools/studioInstallThemeShell.js';
import { registerStudioInstallProofShell } from '../studio-mcp/dist/tools/studioInstallProofShell.js';
import { registerStudioProjectStatus } from '../studio-mcp/dist/tools/studioProjectStatus.js';
import { registerStudioBootstrapDiagnostics } from '../studio-mcp/dist/tools/studioBootstrapDiagnostics.js';
import { registerStudioGetTemplateInfo } from '../studio-mcp/dist/tools/studioGetTemplateInfo.js';
import { registerStudioImportExistingProject } from '../studio-mcp/dist/tools/studioImportExistingProject.js';
import { registerStudioGetNextStep } from '../studio-mcp/dist/tools/studioGetNextStep.js';
import { registerStudioCreateChapterStub } from '../studio-mcp/dist/tools/studioCreateChapterStub.js';
import { registerStudioCreateCharacterStub } from '../studio-mcp/dist/tools/studioCreateCharacterStub.js';
import { registerStudioExportTemplate } from '../studio-mcp/dist/tools/studioExportTemplate.js';
import { registerStudioDiffProjectVsTemplate } from '../studio-mcp/dist/tools/studioDiffProjectVsTemplate.js';
// v1.3.0 repair tools
import { registerStudioPlanRepair } from '../studio-mcp/dist/tools/studioPlanRepair.js';
import { registerStudioApplyRepair } from '../studio-mcp/dist/tools/studioApplyRepair.js';
import { registerStudioGetRepairStatus } from '../studio-mcp/dist/tools/studioGetRepairStatus.js';
// v1.4.0 adoption + quality tools
import { registerStudioGetAdoptionPlan } from '../studio-mcp/dist/tools/studioGetAdoptionPlan.js';
import { registerStudioGetQualityState } from '../studio-mcp/dist/tools/studioGetQualityState.js';
import { registerStudioApproveRepair } from '../studio-mcp/dist/tools/studioApproveRepair.js';
// v1.6.0 chapter spine tools
import { registerChapterCreate } from '../studio-mcp/dist/tools/chapterCreate.js';
import { registerChapterGetHealth } from '../studio-mcp/dist/tools/chapterGetHealth.js';
import { registerChapterGetCoverageMap } from '../studio-mcp/dist/tools/chapterGetCoverageMap.js';
import { registerChapterGetNextStep } from '../studio-mcp/dist/tools/chapterGetNextStep.js';
import { registerChapterGetPlaytestStatus } from '../studio-mcp/dist/tools/chapterGetPlaytestStatus.js';
import { registerChapterList } from '../studio-mcp/dist/tools/chapterList.js';
import { registerChapterRunFullProof } from '../studio-mcp/dist/tools/chapterRunFullProof.js';
import { registerChapterGetTimeline } from '../studio-mcp/dist/tools/chapterGetTimeline.js';

// Engine Bridge tools
import { registerVerifyRuntimePaths } from '../engine-bridge-mcp/dist/tools/verifyRuntimePaths.js';
import { registerReportPlaceholders } from '../engine-bridge-mcp/dist/tools/reportPlaceholders.js';
import { registerReportUnintegrated } from '../engine-bridge-mcp/dist/tools/reportUnintegrated.js';
import { registerGetBattleRuntimeStatus } from '../engine-bridge-mcp/dist/tools/getBattleRuntimeStatus.js';
import { registerSyncSpritePack } from '../engine-bridge-mcp/dist/tools/syncSpritePack.js';
import { registerSyncEncounterManifests } from '../engine-bridge-mcp/dist/tools/syncEncounterManifests.js';

// Godot truth reader tools (engine-bridge Phase 5B)
import { registerInspectProject } from '../engine-bridge-mcp/dist/tools/inspectProject.js';
import { registerSceneGraph } from '../engine-bridge-mcp/dist/tools/sceneGraph.js';
import { registerTemplateShellVerify } from '../engine-bridge-mcp/dist/tools/templateShellVerify.js';
import { registerResourceUidAudit } from '../engine-bridge-mcp/dist/tools/resourceUidAudit.js';
import { registerAutoloadContract } from '../engine-bridge-mcp/dist/tools/autoloadContract.js';
import { registerSignalContractAudit } from '../engine-bridge-mcp/dist/tools/signalContractAudit.js';
import { registerExportAudit } from '../engine-bridge-mcp/dist/tools/exportAudit.js';
import { registerAssetImportAudit } from '../engine-bridge-mcp/dist/tools/assetImportAudit.js';

// Battle Scene tools (v1.5.0)
import { setDb as setBattleSceneDb } from '../battle-scene-mcp/dist/server.js';
import { registerBattleCreateSceneContract } from '../battle-scene-mcp/dist/tools/battleCreateSceneContract.js';
import { registerBattleUpdateSceneContract } from '../battle-scene-mcp/dist/tools/battleUpdateSceneContract.js';
import { registerBattleGetSceneContract } from '../battle-scene-mcp/dist/tools/battleGetSceneContract.js';
import { registerBattleValidateSceneContract } from '../battle-scene-mcp/dist/tools/battleValidateSceneContract.js';
import { registerBattleConfigureLayers } from '../battle-scene-mcp/dist/tools/battleConfigureLayers.js';
import { registerBattleValidateLayerDependencies } from '../battle-scene-mcp/dist/tools/battleValidateLayerDependencies.js';
import { registerBattleGetLayerStatus } from '../battle-scene-mcp/dist/tools/battleGetLayerStatus.js';
import { registerBattleRunSceneProof } from '../battle-scene-mcp/dist/tools/battleRunSceneProof.js';
import { registerBattleGetSceneReadability } from '../battle-scene-mcp/dist/tools/battleGetSceneReadability.js';
import { registerBattleGetSceneNextStep } from '../battle-scene-mcp/dist/tools/battleGetSceneNextStep.js';
import { registerBattleCaptureSnapshot } from '../battle-scene-mcp/dist/tools/battleCaptureSnapshot.js';
import { registerBattleListSnapshots } from '../battle-scene-mcp/dist/tools/battleListSnapshots.js';
import { registerBattleStartPlaytest } from '../battle-scene-mcp/dist/tools/battleStartPlaytest.js';
import { registerBattleRecordPlaytestResult } from '../battle-scene-mcp/dist/tools/battleRecordPlaytestResult.js';

// ─── Single DB connection ───────────────────────────────────
const db = openDatabase();

// ─── Single MCP server, 130 tools ───────────────────────────
const server = new McpServer({
  name: 'game-foundry-mcp',
  version: '1.6.0',
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

// Godot truth readers + auditors (8)
registerInspectProject(server, db);
registerSceneGraph(server, db);
registerTemplateShellVerify(server, db);
registerResourceUidAudit(server, db);
registerAutoloadContract(server, db);
registerSignalContractAudit(server, db);
registerExportAudit(server, db);
registerAssetImportAudit(server, db);

// Proof Lab (15)
setProofDb(db);
registerProofRunAssetSuite(server);
registerProofRunEncounterSuite(server);
registerProofRunRuntimeSuite(server);
registerProofRunChapterSpine(server);
registerProofRunPresentationSuite(server);
registerProofGetFreezeReadiness(server);
registerProofFreezeCandidate(server);
registerProofPromoteFreeze(server);
registerProofReportRegressions(server);
registerProofGetTimeline(server);
registerProofGenerateFreezeReport(server);
registerProofGetNextStep(server);
registerProofRevokeFreeze(server);
registerProofCompareRuns(server);
registerProofGetProjectMatrix(server);
registerProofRunVisualSuite(server);

// Canon Layer (15)
setCanonDb(db);
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

// Studio Bootstrap (16)
setStudioDb(db);
registerStudioCreateProject(server);
registerStudioBootstrapTemplate(server);
registerStudioSeedRegistry(server);
registerStudioSeedVault(server);
registerStudioInstallRuntimeShell(server);
registerStudioInstallThemeShell(server);
registerStudioInstallProofShell(server);
registerStudioProjectStatus(server);
registerStudioBootstrapDiagnostics(server);
registerStudioGetTemplateInfo(server);
registerStudioImportExistingProject(server);
registerStudioGetNextStep(server);
registerStudioCreateChapterStub(server);
registerStudioCreateCharacterStub(server);
registerStudioExportTemplate(server);
registerStudioDiffProjectVsTemplate(server);

// Studio Repair + Adoption + Quality (v1.3.0 + v1.4.0)
registerStudioPlanRepair(server);
registerStudioApplyRepair(server);
registerStudioGetRepairStatus(server);
registerStudioGetAdoptionPlan(server);
registerStudioGetQualityState(server);
registerStudioApproveRepair(server);

// Chapter Spine (8) — v1.6.0
registerChapterCreate(server);
registerChapterGetHealth(server);
registerChapterGetCoverageMap(server);
registerChapterGetNextStep(server);
registerChapterGetPlaytestStatus(server);
registerChapterList(server);
registerChapterRunFullProof(server);
registerChapterGetTimeline(server);

// Battle Scene (14) — v1.5.0
setBattleSceneDb(db);
registerBattleCreateSceneContract(server);
registerBattleUpdateSceneContract(server);
registerBattleGetSceneContract(server);
registerBattleValidateSceneContract(server);
registerBattleConfigureLayers(server);
registerBattleValidateLayerDependencies(server);
registerBattleGetLayerStatus(server);
registerBattleRunSceneProof(server);
registerBattleGetSceneReadability(server);
registerBattleGetSceneNextStep(server);
registerBattleCaptureSnapshot(server);
registerBattleListSnapshots(server);
registerBattleStartPlaytest(server);
registerBattleRecordPlaytestResult(server);

// ─── Connect ────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
