export {
  createChapter,
  getChapterEncounters,
  transitionChapterState,
  getChapter,
  listChapters,
} from './chapter-contract.js';

export {
  getEncounterCoverageMap,
  computeChapterHealth,
} from './chapter-health.js';

export type { ChapterHealthResult } from './chapter-health.js';

export { getChapterNextStep } from './chapter-next-step.js';
export type { ChapterNextStepResult } from './chapter-next-step.js';

export { getChapterPlaytestStatus } from './chapter-playtest.js';
export type { ChapterPlaytestStatus } from './chapter-playtest.js';

export { runChapterProveBundle } from './chapter-prove.js';
export type { ChapterProveResult, EncounterSceneProofEntry } from './chapter-prove.js';

export { computeChapterVerdict } from './chapter-verdict.js';
export type { ChapterVerdictResult } from './chapter-verdict.js';

export { generateChapterHandoff } from './chapter-handoff.js';
export type { ChapterHandoffArtifact } from './chapter-handoff.js';

export { getChapterFreezeCalibration } from './chapter-freeze.js';
export type { ChapterFreezeCalibration } from './chapter-freeze.js';
