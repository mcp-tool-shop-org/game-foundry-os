// State machine
export {
  ENCOUNTER_PRODUCTION_STATES,
  canEncounterTransition,
  transitionEncounterState,
  getEncounterProductionState,
  getEncounterStateEvents,
} from './state-machine.js';
export type { EncounterTransitionResult } from './state-machine.js';

// Roster
export {
  addUnit,
  moveUnit,
  removeUnit,
  getUnits,
  getUnitCount,
} from './roster.js';
export type { AddUnitInput, MoveUnitInput } from './roster.js';

// Rules
export {
  attachRule,
  getRules,
  removeRule,
} from './rules.js';
export type { AttachRuleInput } from './rules.js';

// Validation
export {
  validateStructural,
  validateDependencies,
  getValidationHistory,
} from './validation.js';
export type { ValidationReport } from './validation.js';

// Export
export {
  exportManifest,
  getExports,
  getCanonicalExport,
} from './export.js';
export type { ExportResult } from './export.js';

// Sync
export {
  syncToEngine,
  getSyncReceipts,
} from './sync.js';
export type { SyncResult } from './sync.js';

// Next step
export {
  getEncounterNextStep,
} from './next-step.js';

// Timeline
export {
  getEncounterTimeline,
  getChapterMatrix,
} from './timeline.js';
export type { EncounterTimelineEntry, ChapterMatrixEntry } from './timeline.js';

// Diff
export {
  diffManifestVsRuntime,
} from './diff.js';
export type { DiffResult } from './diff.js';
