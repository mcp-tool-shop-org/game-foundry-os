export {
  createSceneContract,
  validateSceneContract,
  transitionSceneContractState,
} from './scene-contract.js';

export type { ContractValidationResult } from './scene-contract.js';

export {
  configureDefaultLayers,
  configureLayer,
  validateLayerDependencies,
  getLayerStatus,
} from './ui-layers.js';

export type { LayerDependencyResult, LayerValidationResult } from './ui-layers.js';

export { runSceneProof } from './scene-proof.js';

export type { SceneProofAssertion, SceneProofResult, SpriteMetrics } from './scene-proof.js';

export {
  captureSnapshot,
  captureAllSnapshots,
  listSnapshots,
} from './scene-snapshot.js';

export type { UnitLayout, SnapshotLayout } from './scene-snapshot.js';

export {
  startPlaytest,
  recordPlaytestFailures,
  completePlaytest,
  abandonPlaytest,
  getLatestPlaytest,
  computePlaytestReadability,
} from './playtest-hook.js';

export type { PlaytestReadabilityScore } from './playtest-hook.js';

export { runBattleSceneDiagnostics } from './scene-diagnostics.js';
