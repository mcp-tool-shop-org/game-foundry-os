import fs from 'node:fs';
import path from 'node:path';

export interface GodotProjectConfig {
  config: {
    name: string;
    features: string[];
    description: string;
  };
  run: {
    main_scene: string;
  };
  autoloads: Array<{ name: string; path: string; is_singleton: boolean }>;
  input_actions: string[];
  editor_plugins: string[];
  display: {
    width: number;
    height: number;
    stretch_mode: string;
    scale_mode: string;
  };
  rendering: {
    renderer: string;
  };
  theme: {
    custom_theme: string;
  };
  logging: {
    file_logging_enabled: boolean;
    log_path: string;
  };
}

/** Parse a Godot INI value, handling PackedStringArray, quoted strings, booleans, numbers, Vector2i */
export function parseGodotValue(raw: string): unknown {
  const trimmed = raw.trim();

  // PackedStringArray("a", "b")
  const psaMatch = trimmed.match(/^PackedStringArray\((.+)\)$/);
  if (psaMatch) {
    const inner = psaMatch[1];
    const items: string[] = [];
    // Match quoted strings
    const re = /"([^"]*?)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner)) !== null) {
      items.push(m[1]);
    }
    return items;
  }

  // Vector2i(x, y)
  const vecMatch = trimmed.match(/^Vector2i\(\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (vecMatch) {
    return { x: parseInt(vecMatch[1], 10), y: parseInt(vecMatch[2], 10) };
  }

  // Quoted string
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  // Booleans
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Numbers
  const num = Number(trimmed);
  if (!Number.isNaN(num) && trimmed !== '') return num;

  return trimmed;
}

/** Parse an INI file into sections with key/value pairs */
export function parseIniSections(content: string): Map<string, Map<string, unknown>> {
  const sections = new Map<string, Map<string, unknown>>();
  let currentSection = '';
  sections.set(currentSection, new Map());

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';') || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      if (!sections.has(currentSection)) {
        sections.set(currentSection, new Map());
      }
      continue;
    }

    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const value = line.slice(eqIdx + 1).trim();
      sections.get(currentSection)!.set(key, parseGodotValue(value));
    }
  }

  return sections;
}

function getString(sections: Map<string, Map<string, unknown>>, section: string, key: string, def = ''): string {
  const sec = sections.get(section);
  if (!sec) return def;
  const val = sec.get(key);
  return typeof val === 'string' ? val : def;
}

function getNumber(sections: Map<string, Map<string, unknown>>, section: string, key: string, def = 0): number {
  const sec = sections.get(section);
  if (!sec) return def;
  const val = sec.get(key);
  return typeof val === 'number' ? val : def;
}

function getBool(sections: Map<string, Map<string, unknown>>, section: string, key: string, def = false): boolean {
  const sec = sections.get(section);
  if (!sec) return def;
  const val = sec.get(key);
  return typeof val === 'boolean' ? val : def;
}

function getStringArray(sections: Map<string, Map<string, unknown>>, section: string, key: string): string[] {
  const sec = sections.get(section);
  if (!sec) return [];
  const val = sec.get(key);
  return Array.isArray(val) ? val as string[] : [];
}

/** Parse project.godot file from a project root directory */
export function parseProjectGodot(projectRoot: string): GodotProjectConfig {
  const filePath = path.join(projectRoot, 'project.godot');
  if (!fs.existsSync(filePath)) {
    return emptyProjectConfig();
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const sections = parseIniSections(content);

  // Parse autoloads from [autoload] section
  const autoloads: GodotProjectConfig['autoloads'] = [];
  const autoloadSection = sections.get('autoload');
  if (autoloadSection) {
    for (const [name, rawPath] of autoloadSection) {
      const pathStr = typeof rawPath === 'string' ? rawPath : String(rawPath);
      const isSingleton = pathStr.startsWith('*');
      const cleanPath = isSingleton ? pathStr.slice(1) : pathStr;
      autoloads.push({ name, path: cleanPath, is_singleton: isSingleton });
    }
  }

  // Parse input actions from [input] section
  const inputActions: string[] = [];
  const inputSection = sections.get('input');
  if (inputSection) {
    for (const key of inputSection.keys()) {
      // Input actions look like "ui_accept" with sub-keys, but in project.godot they appear as full keys
      inputActions.push(key);
    }
  }

  return {
    config: {
      name: getString(sections, 'application', 'config/name'),
      features: getStringArray(sections, 'application', 'config/features'),
      description: getString(sections, 'application', 'config/description'),
    },
    run: {
      main_scene: getString(sections, 'application', 'run/main_scene'),
    },
    autoloads,
    input_actions: inputActions,
    editor_plugins: getStringArray(sections, 'editor_plugins', 'enabled'),
    display: {
      width: getNumber(sections, 'display', 'window/size/viewport_width'),
      height: getNumber(sections, 'display', 'window/size/viewport_height'),
      stretch_mode: getString(sections, 'display', 'window/stretch/mode'),
      scale_mode: getString(sections, 'display', 'window/stretch/scale_mode'),
    },
    rendering: {
      renderer: getString(sections, 'rendering', 'renderer/rendering_method'),
    },
    theme: {
      custom_theme: getString(sections, 'display', 'theme/custom_theme'),
    },
    logging: {
      file_logging_enabled: getBool(sections, 'debug', 'file_logging/enable_file_logging'),
      log_path: getString(sections, 'debug', 'file_logging/log_path'),
    },
  };
}

function emptyProjectConfig(): GodotProjectConfig {
  return {
    config: { name: '', features: [], description: '' },
    run: { main_scene: '' },
    autoloads: [],
    input_actions: [],
    editor_plugins: [],
    display: { width: 0, height: 0, stretch_mode: '', scale_mode: '' },
    rendering: { renderer: '' },
    theme: { custom_theme: '' },
    logging: { file_logging_enabled: false, log_path: '' },
  };
}
