import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { openDatabase } from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

import { registerBattleCreateSceneContract } from './tools/battleCreateSceneContract.js';
import { registerBattleUpdateSceneContract } from './tools/battleUpdateSceneContract.js';
import { registerBattleGetSceneContract } from './tools/battleGetSceneContract.js';
import { registerBattleValidateSceneContract } from './tools/battleValidateSceneContract.js';
import { registerBattleConfigureLayers } from './tools/battleConfigureLayers.js';
import { registerBattleValidateLayerDependencies } from './tools/battleValidateLayerDependencies.js';
import { registerBattleGetLayerStatus } from './tools/battleGetLayerStatus.js';
import { registerBattleRunSceneProof } from './tools/battleRunSceneProof.js';
import { registerBattleGetSceneReadability } from './tools/battleGetSceneReadability.js';
import { registerBattleGetSceneNextStep } from './tools/battleGetSceneNextStep.js';
import { registerBattleCaptureSnapshot } from './tools/battleCaptureSnapshot.js';
import { registerBattleListSnapshots } from './tools/battleListSnapshots.js';
import { registerBattleStartPlaytest } from './tools/battleStartPlaytest.js';
import { registerBattleRecordPlaytestResult } from './tools/battleRecordPlaytestResult.js';

let _db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (!_db) {
    _db = openDatabase();
  }
  return _db;
}

export function setDb(db: Database.Database): void {
  _db = db;
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'battle-scene-mcp',
    version: '0.1.0',
  });

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

  return server;
}

export {
  registerBattleCreateSceneContract,
  registerBattleUpdateSceneContract,
  registerBattleGetSceneContract,
  registerBattleValidateSceneContract,
  registerBattleConfigureLayers,
  registerBattleValidateLayerDependencies,
  registerBattleGetLayerStatus,
  registerBattleRunSceneProof,
  registerBattleGetSceneReadability,
  registerBattleGetSceneNextStep,
  registerBattleCaptureSnapshot,
  registerBattleListSnapshots,
  registerBattleStartPlaytest,
  registerBattleRecordPlaytestResult,
};
