// Vault
export { syncVault, parseMarkdownFrontmatter } from './vault.js';
export type { ParsedFrontmatter, VaultSyncResult } from './vault.js';

// Pages
export { getPage, getPageById, listPages, updatePageStatus, searchPages } from './pages.js';

// Links
export { linkObject, getLinks, getLinksTo, unlinkObject } from './links.js';
export type { LinkObjectInput } from './links.js';

// Snapshots
export { createSnapshot, getSnapshots, compareSnapshots } from './snapshots.js';
export type { SnapshotComparisonResult } from './snapshots.js';

// Drift
export { detectDrift } from './drift.js';
export type { DriftResult, DriftDetail } from './drift.js';

// Handoff
export { generateHandoff } from './handoff.js';
export type { HandoffContent } from './handoff.js';

// Timeline
export { getCanonTimeline } from './timeline.js';
export type { CanonTimelineEntry } from './timeline.js';

// Next step
export { getCanonNextStep } from './next-step.js';
export type { CanonNextStepResult } from './next-step.js';
