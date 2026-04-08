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

  return server;
}
