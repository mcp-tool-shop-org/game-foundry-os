import fs from 'node:fs';
import path from 'node:path';
import { parseIniSections, parseGodotValue } from './godot-project.js';

/** Result of a Godot project.godot mutation */
export interface GodotMutationResult {
  action: string;
  target_path: string;
  dry_run: boolean;
  changes: Array<{ section: string; key: string; old_value: unknown; new_value: unknown }>;
  file_written: boolean;
}

/** Serialize a value back into Godot INI format */
export function serializeGodotValue(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    const items = value.map(v => `"${v}"`).join(', ');
    return `PackedStringArray(${items})`;
  }
  if (typeof value === 'object' && value !== null && 'x' in value && 'y' in value) {
    const v = value as { x: number; y: number };
    return `Vector2i(${v.x}, ${v.y})`;
  }
  return String(value);
}

// ─── Approved mutation boundaries ──────────────────────────

const APPROVED_SECTIONS = new Set([
  'autoload',
  'editor_plugins',
  'display',
  'rendering',
  'application',
]);

function isMutationApproved(section: string): boolean {
  return APPROVED_SECTIONS.has(section);
}

// ─── Targeted line-level mutation engine ───────────────────

/**
 * Apply a targeted mutation to project.godot content.
 * Finds or creates the section, then sets or updates the key.
 * Returns the mutated content and what changed.
 */
function applyMutation(
  content: string,
  section: string,
  key: string,
  newValue: unknown,
): { mutated: string; oldValue: unknown; created_section: boolean } {
  const lines = content.split('\n');
  const sectionHeader = `[${section}]`;
  let sectionStart = -1;
  let sectionEnd = lines.length;
  let keyLine = -1;
  let oldValue: unknown = undefined;

  // Find the section
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === sectionHeader) {
      sectionStart = i;
      // Find end of section (next section header or EOF)
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().startsWith('[') && lines[j].trim().endsWith(']')) {
          sectionEnd = j;
          break;
        }
      }
      break;
    }
  }

  const serialized = serializeGodotValue(newValue);

  // If section doesn't exist, append it
  if (sectionStart === -1) {
    const newLines = [...lines];
    // Ensure trailing newline before new section
    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
      newLines.push('');
    }
    newLines.push(sectionHeader);
    newLines.push('');
    newLines.push(`${key}=${serialized}`);
    newLines.push('');
    return { mutated: newLines.join('\n'), oldValue: undefined, created_section: true };
  }

  // Section exists — find the key within it
  for (let i = sectionStart + 1; i < sectionEnd; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith(';') || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const lineKey = trimmed.slice(0, eqIdx).trim();
      if (lineKey === key) {
        keyLine = i;
        const rawVal = trimmed.slice(eqIdx + 1).trim();
        oldValue = parseGodotValue(rawVal);
        break;
      }
    }
  }

  const newLines = [...lines];
  if (keyLine >= 0) {
    // Update existing key
    newLines[keyLine] = `${key}=${serialized}`;
  } else {
    // Insert new key at end of section (before next section or EOF)
    // Find the last non-empty line in the section
    let insertAt = sectionStart + 1;
    for (let i = sectionEnd - 1; i > sectionStart; i--) {
      if (lines[i].trim() !== '') {
        insertAt = i + 1;
        break;
      }
    }
    newLines.splice(insertAt, 0, `${key}=${serialized}`);
  }

  return { mutated: newLines.join('\n'), oldValue, created_section: false };
}

function readProjectGodot(projectRoot: string): string {
  const filePath = path.join(projectRoot, 'project.godot');
  if (!fs.existsSync(filePath)) {
    throw new Error(`project.godot not found at ${projectRoot}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function writeProjectGodot(projectRoot: string, content: string): void {
  const filePath = path.join(projectRoot, 'project.godot');
  fs.writeFileSync(filePath, content, 'utf-8');
}

// ─── Public mutation functions ─────────────────────────────

/**
 * Register an autoload in project.godot [autoload] section.
 * Format: Name=*"res://path/to/script.gd" (singleton) or Name="res://path" (non-singleton)
 */
export function registerAutoload(
  projectRoot: string,
  name: string,
  scriptPath: string,
  isSingleton: boolean,
  dryRun: boolean,
): GodotMutationResult {
  const content = readProjectGodot(projectRoot);
  // Autoload values use a special format: *"res://..." for singletons
  const prefix = isSingleton ? '*' : '';
  const autoloadValue = `${prefix}"${scriptPath}"`;

  // Check if already registered
  const sections = parseIniSections(content);
  const autoloadSection = sections.get('autoload');
  if (autoloadSection?.has(name)) {
    const existing = autoloadSection.get(name);
    return {
      action: 'register_autoload',
      target_path: path.join(projectRoot, 'project.godot'),
      dry_run: dryRun,
      changes: [],
      file_written: false,
    };
  }

  // Apply mutation using raw line insertion (autoload values have special format)
  const lines = content.split('\n');
  const sectionHeader = '[autoload]';
  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === sectionHeader) {
      sectionStart = i;
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim().startsWith('[') && lines[j].trim().endsWith(']')) {
          sectionEnd = j;
          break;
        }
      }
      break;
    }
  }

  const newLine = `${name}=${autoloadValue}`;
  let mutated: string;

  if (sectionStart === -1) {
    // Create section
    const newLines = [...lines];
    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== '') {
      newLines.push('');
    }
    newLines.push(sectionHeader);
    newLines.push('');
    newLines.push(newLine);
    newLines.push('');
    mutated = newLines.join('\n');
  } else {
    // Insert at end of autoload section
    const newLines = [...lines];
    let insertAt = sectionStart + 1;
    for (let i = sectionEnd - 1; i > sectionStart; i--) {
      if (lines[i].trim() !== '') {
        insertAt = i + 1;
        break;
      }
    }
    newLines.splice(insertAt, 0, newLine);
    mutated = newLines.join('\n');
  }

  if (!dryRun) {
    writeProjectGodot(projectRoot, mutated);
  }

  return {
    action: 'register_autoload',
    target_path: path.join(projectRoot, 'project.godot'),
    dry_run: dryRun,
    changes: [{ section: 'autoload', key: name, old_value: undefined, new_value: autoloadValue }],
    file_written: !dryRun,
  };
}

/**
 * Enable an editor plugin in project.godot [editor_plugins] section.
 */
export function enablePlugin(
  projectRoot: string,
  pluginPath: string,
  dryRun: boolean,
): GodotMutationResult {
  const content = readProjectGodot(projectRoot);
  const sections = parseIniSections(content);

  // Get current enabled plugins
  const pluginSection = sections.get('editor_plugins');
  const currentPlugins = pluginSection?.get('enabled');
  const pluginList: string[] = Array.isArray(currentPlugins) ? currentPlugins as string[] : [];

  if (pluginList.includes(pluginPath)) {
    return {
      action: 'enable_plugin',
      target_path: path.join(projectRoot, 'project.godot'),
      dry_run: dryRun,
      changes: [],
      file_written: false,
    };
  }

  const newPlugins = [...pluginList, pluginPath];
  const { mutated } = applyMutation(content, 'editor_plugins', 'enabled', newPlugins);

  if (!dryRun) {
    writeProjectGodot(projectRoot, mutated);
  }

  return {
    action: 'enable_plugin',
    target_path: path.join(projectRoot, 'project.godot'),
    dry_run: dryRun,
    changes: [{ section: 'editor_plugins', key: 'enabled', old_value: pluginList, new_value: newPlugins }],
    file_written: !dryRun,
  };
}

/**
 * Apply a project setting to project.godot.
 * Only approved sections are allowed.
 */
export function applyProjectSetting(
  projectRoot: string,
  section: string,
  key: string,
  value: unknown,
  dryRun: boolean,
): GodotMutationResult {
  if (!isMutationApproved(section)) {
    throw new Error(`Mutation to section "${section}" is not approved. Approved: ${[...APPROVED_SECTIONS].join(', ')}`);
  }

  const content = readProjectGodot(projectRoot);
  const { mutated, oldValue } = applyMutation(content, section, key, value);

  if (!dryRun) {
    writeProjectGodot(projectRoot, mutated);
  }

  return {
    action: 'apply_project_setting',
    target_path: path.join(projectRoot, 'project.godot'),
    dry_run: dryRun,
    changes: [{ section, key, old_value: oldValue, new_value: value }],
    file_written: !dryRun,
  };
}

/**
 * Apply a display setting (shorthand for applyProjectSetting with 'display' section).
 */
export function applyDisplaySetting(
  projectRoot: string,
  key: string,
  value: unknown,
  dryRun: boolean,
): GodotMutationResult {
  return applyProjectSetting(projectRoot, 'display', key, value, dryRun);
}

/**
 * Apply a rendering setting (shorthand for applyProjectSetting with 'rendering' section).
 */
export function applyRenderingSetting(
  projectRoot: string,
  key: string,
  value: unknown,
  dryRun: boolean,
): GodotMutationResult {
  return applyProjectSetting(projectRoot, 'rendering', key, value, dryRun);
}
