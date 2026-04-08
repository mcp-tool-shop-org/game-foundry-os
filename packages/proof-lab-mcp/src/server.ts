import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

import { registerProofRunAssetSuite } from './tools/proofRunAssetSuite.js';
import { registerProofRunEncounterSuite } from './tools/proofRunEncounterSuite.js';
import { registerProofRunRuntimeSuite } from './tools/proofRunRuntimeSuite.js';
import { registerProofRunChapterSpine } from './tools/proofRunChapterSpine.js';
import { registerProofRunPresentationSuite } from './tools/proofRunPresentationSuite.js';
import { registerProofGetFreezeReadiness } from './tools/proofGetFreezeReadiness.js';
import { registerProofFreezeCandidate } from './tools/proofFreezeCandidate.js';
import { registerProofPromoteFreeze } from './tools/proofPromoteFreeze.js';
import { registerProofReportRegressions } from './tools/proofReportRegressions.js';
import { registerProofGetTimeline } from './tools/proofGetTimeline.js';
import { registerProofGenerateFreezeReport } from './tools/proofGenerateFreezeReport.js';
import { registerProofGetNextStep } from './tools/proofGetNextStep.js';
import { registerProofRevokeFreeze } from './tools/proofRevokeFreeze.js';
import { registerProofCompareRuns } from './tools/proofCompareRuns.js';
import { registerProofGetProjectMatrix } from './tools/proofGetProjectMatrix.js';
import { registerProofRunVisualSuite } from './tools/proofRunVisualSuite.js';

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
    name: 'proof-lab-mcp',
    version: '0.1.0',
  });

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

  return server;
}
