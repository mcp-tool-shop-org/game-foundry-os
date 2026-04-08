/**
 * Library exports for cross-package consumption.
 * This barrel re-exports tool functions and utility parsers
 * so sibling packages (like studio-bootstrap-core) can import them
 * without depending on the MCP server runtime.
 */

// ─── Utility parsers (pure functions, no DB) ─────────────────
export { parseProjectGodot, parseIniSections, parseGodotValue } from './utils/godot-project.js';
export type { GodotProjectConfig } from './utils/godot-project.js';

export { parseScene } from './utils/godot-scene.js';
export type { ParsedScene, ExtResource, SubResource, SceneNode, SceneConnection } from './utils/godot-scene.js';

export { parseImportFile, auditImportSettings } from './utils/godot-import.js';
export type { ImportFileData, ImportAuditIssue, ImportAuditResult } from './utils/godot-import.js';

export {
  DIRECTIONS, DIRECTIONAL_DIRS, DIR_MAP,
  PORTRAIT_SIZES, PORTRAIT_DIR,
  packAlbedoDir, directionalSourceDir, portraitPath,
  checkPackDirections, countDirectionFiles, checkPortraits, checkDirectionalSource,
} from './utils/godot.js';
export type { DirectionCheck } from './utils/godot.js';

// ─── Tool functions (require db + projectId) ─────────────────
export { inspectProject } from './tools/inspectProject.js';
export type { InspectProjectResult } from './tools/inspectProject.js';

export { templateShellVerify } from './tools/templateShellVerify.js';
export type { TemplateShellVerifyResult, ShellCheck } from './tools/templateShellVerify.js';

export { autoloadContract } from './tools/autoloadContract.js';
export type { AutoloadEntry, AutoloadContractResult } from './tools/autoloadContract.js';

export { exportAudit } from './tools/exportAudit.js';
export type { ExportPreset, ExportAuditIssue, ExportAuditResult } from './tools/exportAudit.js';

export { assetImportAudit } from './tools/assetImportAudit.js';
export type { AssetImportAuditResult } from './tools/assetImportAudit.js';

// ─── Godot writer (mutation channel) ────────────────────────
export {
  serializeGodotValue,
  registerAutoload,
  enablePlugin,
  applyProjectSetting,
  applyDisplaySetting,
  applyRenderingSetting,
} from './utils/godot-writer.js';
export type { GodotMutationResult } from './utils/godot-writer.js';
