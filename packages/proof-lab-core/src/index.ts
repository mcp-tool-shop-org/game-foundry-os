// Suites
export { createSuite, getSuite, listSuites } from './suites.js';
export type { CreateSuiteInput } from './suites.js';

// Runs
export { createProofRun, addAssertion, getProofRun, getLatestRun, listRuns, getAssertions } from './runs.js';
export type { CreateProofRunInput } from './runs.js';

// Asset proof
export { runAssetSuite } from './asset-proof.js';
export type { AssetSuiteResult } from './asset-proof.js';

// Encounter proof
export { runEncounterSuite } from './encounter-proof.js';
export type { EncounterSuiteResult } from './encounter-proof.js';

// Runtime proof
export { runRuntimeSuite } from './runtime-proof.js';
export type { RuntimeSuiteResult } from './runtime-proof.js';

// Visual integrity proof
export { runVisualSuite, checkSprite } from './visual-proof.js';
export type { VisualSuiteResult, SpriteCheckResult, VisualCheckConfig } from './visual-proof.js';

// Freeze
export { getFreezeReadiness, createFreezeCandidate, promoteFreeze, revokeFreeze } from './freeze.js';

// Regressions
export { detectRegressions, listRegressions } from './regressions.js';
export type { DetectRegressionsResult } from './regressions.js';

// Next step
export { getProofNextStep } from './next-step.js';
export type { ProofNextStepResult } from './next-step.js';

// Timeline
export { getProofTimeline } from './timeline.js';
export type { ProofTimelineEntry } from './timeline.js';

// Report
export { generateFreezeReport } from './report.js';
export type { FreezeReport, FreezeReportSuiteEntry } from './report.js';
