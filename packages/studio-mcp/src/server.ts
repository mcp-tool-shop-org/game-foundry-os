import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

import { registerStudioCreateProject } from './tools/studioCreateProject.js';
import { registerStudioBootstrapTemplate } from './tools/studioBootstrapTemplate.js';
import { registerStudioSeedRegistry } from './tools/studioSeedRegistry.js';
import { registerStudioSeedVault } from './tools/studioSeedVault.js';
import { registerStudioInstallRuntimeShell } from './tools/studioInstallRuntimeShell.js';
import { registerStudioInstallThemeShell } from './tools/studioInstallThemeShell.js';
import { registerStudioInstallProofShell } from './tools/studioInstallProofShell.js';
import { registerStudioProjectStatus } from './tools/studioProjectStatus.js';
import { registerStudioBootstrapDiagnostics } from './tools/studioBootstrapDiagnostics.js';
import { registerStudioGetTemplateInfo } from './tools/studioGetTemplateInfo.js';
import { registerStudioImportExistingProject } from './tools/studioImportExistingProject.js';
import { registerStudioGetNextStep } from './tools/studioGetNextStep.js';
import { registerStudioCreateChapterStub } from './tools/studioCreateChapterStub.js';
import { registerStudioCreateCharacterStub } from './tools/studioCreateCharacterStub.js';
import { registerStudioExportTemplate } from './tools/studioExportTemplate.js';
import { registerStudioDiffProjectVsTemplate } from './tools/studioDiffProjectVsTemplate.js';
import { registerStudioPlanRepair } from './tools/studioPlanRepair.js';
import { registerStudioApplyRepair } from './tools/studioApplyRepair.js';
import { registerStudioGetRepairStatus } from './tools/studioGetRepairStatus.js';
import { registerStudioGetAdoptionPlan } from './tools/studioGetAdoptionPlan.js';
import { registerStudioGetQualityState } from './tools/studioGetQualityState.js';
import { registerStudioApproveRepair } from './tools/studioApproveRepair.js';

// Chapter Spine tools (v1.6.0)
import { registerChapterCreate } from './tools/chapterCreate.js';
import { registerChapterGetHealth } from './tools/chapterGetHealth.js';
import { registerChapterGetCoverageMap } from './tools/chapterGetCoverageMap.js';
import { registerChapterGetNextStep } from './tools/chapterGetNextStep.js';
import { registerChapterGetPlaytestStatus } from './tools/chapterGetPlaytestStatus.js';
import { registerChapterList } from './tools/chapterList.js';
import { registerChapterRunFullProof } from './tools/chapterRunFullProof.js';
import { registerChapterGetTimeline } from './tools/chapterGetTimeline.js';

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
    name: 'studio-mcp',
    version: '0.1.0',
  });

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
  registerStudioPlanRepair(server);
  registerStudioApplyRepair(server);
  registerStudioGetRepairStatus(server);
  registerStudioGetAdoptionPlan(server);
  registerStudioGetQualityState(server);
  registerStudioApproveRepair(server);

  // Chapter Spine (v1.6.0)
  registerChapterCreate(server);
  registerChapterGetHealth(server);
  registerChapterGetCoverageMap(server);
  registerChapterGetNextStep(server);
  registerChapterGetPlaytestStatus(server);
  registerChapterList(server);
  registerChapterRunFullProof(server);
  registerChapterGetTimeline(server);

  return server;
}
