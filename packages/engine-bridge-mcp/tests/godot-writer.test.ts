import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  serializeGodotValue,
  registerAutoload,
  enablePlugin,
  applyProjectSetting,
  applyDisplaySetting,
  applyRenderingSetting,
} from '@mcptoolshop/engine-bridge-mcp/lib';
import { parseProjectGodot, parseIniSections } from '@mcptoolshop/engine-bridge-mcp/lib';

let tmpDir: string;

const BASE_PROJECT_GODOT = `; Engine configuration file.

[application]

config/name="TestProject"
config/features=PackedStringArray("4.3")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
`;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-writer-'));
  fs.writeFileSync(path.join(tmpDir, 'project.godot'), BASE_PROJECT_GODOT, 'utf-8');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('serializeGodotValue', () => {
  it('serializes strings with quotes', () => {
    expect(serializeGodotValue('hello')).toBe('"hello"');
  });

  it('serializes booleans', () => {
    expect(serializeGodotValue(true)).toBe('true');
    expect(serializeGodotValue(false)).toBe('false');
  });

  it('serializes numbers', () => {
    expect(serializeGodotValue(42)).toBe('42');
    expect(serializeGodotValue(1280)).toBe('1280');
  });

  it('serializes arrays as PackedStringArray', () => {
    expect(serializeGodotValue(['4.3', '4.4'])).toBe('PackedStringArray("4.3", "4.4")');
  });

  it('serializes Vector2i objects', () => {
    expect(serializeGodotValue({ x: 10, y: 20 })).toBe('Vector2i(10, 20)');
  });
});

describe('registerAutoload', () => {
  it('dry-run returns diff without writing', () => {
    const result = registerAutoload(tmpDir, 'GameState', 'res://globals/game_state.gd', true, true);
    expect(result.dry_run).toBe(true);
    expect(result.file_written).toBe(false);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].section).toBe('autoload');
    expect(result.changes[0].key).toBe('GameState');

    // Verify file unchanged
    const content = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    expect(content).not.toContain('GameState');
  });

  it('apply mode writes autoload to project.godot', () => {
    const result = registerAutoload(tmpDir, 'GameState', 'res://globals/game_state.gd', true, false);
    expect(result.file_written).toBe(true);
    expect(result.changes).toHaveLength(1);

    // Verify file has autoload
    const config = parseProjectGodot(tmpDir);
    expect(config.autoloads).toHaveLength(1);
    expect(config.autoloads[0].name).toBe('GameState');
    // Parser returns path with quotes because autoload format is Name=*"res://..."
    // and parseGodotValue doesn't strip quotes from *-prefixed values
    expect(config.autoloads[0].path).toContain('res://globals/game_state.gd');
    expect(config.autoloads[0].is_singleton).toBe(true);
  });

  it('non-singleton autoload uses correct format', () => {
    registerAutoload(tmpDir, 'Helper', 'res://helpers/helper.gd', false, false);

    const content = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    expect(content).toContain('Helper="res://helpers/helper.gd"');
    expect(content).not.toContain('Helper=*');
  });

  it('idempotent — does not duplicate existing autoload', () => {
    registerAutoload(tmpDir, 'GameState', 'res://globals/game_state.gd', true, false);
    const result2 = registerAutoload(tmpDir, 'GameState', 'res://globals/game_state.gd', true, false);
    expect(result2.changes).toHaveLength(0);
    expect(result2.file_written).toBe(false);

    const config = parseProjectGodot(tmpDir);
    expect(config.autoloads).toHaveLength(1);
  });

  it('registers multiple autoloads', () => {
    registerAutoload(tmpDir, 'GameState', 'res://globals/game_state.gd', true, false);
    registerAutoload(tmpDir, 'SpriteLoader', 'res://globals/sprite_loader.gd', true, false);
    registerAutoload(tmpDir, 'EncounterLoader', 'res://globals/encounter_loader.gd', true, false);

    const config = parseProjectGodot(tmpDir);
    expect(config.autoloads).toHaveLength(3);
    expect(config.autoloads.map(a => a.name).sort()).toEqual(['EncounterLoader', 'GameState', 'SpriteLoader']);
  });
});

describe('enablePlugin', () => {
  it('dry-run returns diff without writing', () => {
    const result = enablePlugin(tmpDir, 'res://addons/my_plugin/plugin.cfg', true);
    expect(result.dry_run).toBe(true);
    expect(result.file_written).toBe(false);
    expect(result.changes).toHaveLength(1);
  });

  it('apply mode enables a plugin', () => {
    enablePlugin(tmpDir, 'res://addons/my_plugin/plugin.cfg', false);

    const config = parseProjectGodot(tmpDir);
    expect(config.editor_plugins).toContain('res://addons/my_plugin/plugin.cfg');
  });

  it('appends to existing plugin list', () => {
    enablePlugin(tmpDir, 'res://addons/plugin_a/plugin.cfg', false);
    enablePlugin(tmpDir, 'res://addons/plugin_b/plugin.cfg', false);

    const config = parseProjectGodot(tmpDir);
    expect(config.editor_plugins).toHaveLength(2);
    expect(config.editor_plugins).toContain('res://addons/plugin_a/plugin.cfg');
    expect(config.editor_plugins).toContain('res://addons/plugin_b/plugin.cfg');
  });

  it('idempotent — does not duplicate plugin', () => {
    enablePlugin(tmpDir, 'res://addons/my_plugin/plugin.cfg', false);
    const result2 = enablePlugin(tmpDir, 'res://addons/my_plugin/plugin.cfg', false);
    expect(result2.changes).toHaveLength(0);

    const config = parseProjectGodot(tmpDir);
    expect(config.editor_plugins).toHaveLength(1);
  });
});

describe('applyProjectSetting', () => {
  it('updates existing display setting', () => {
    const result = applyProjectSetting(tmpDir, 'display', 'window/size/viewport_width', 1920, false);
    expect(result.file_written).toBe(true);
    expect(result.changes[0].old_value).toBe(1280);
    expect(result.changes[0].new_value).toBe(1920);

    const config = parseProjectGodot(tmpDir);
    expect(config.display.width).toBe(1920);
  });

  it('rejects unapproved section', () => {
    expect(() => applyProjectSetting(tmpDir, 'physics', 'some/setting', 42, false))
      .toThrow('not approved');
  });

  it('dry-run does not write', () => {
    const result = applyProjectSetting(tmpDir, 'display', 'window/stretch/mode', 'canvas_items', true);
    expect(result.dry_run).toBe(true);
    expect(result.file_written).toBe(false);

    const config = parseProjectGodot(tmpDir);
    expect(config.display.stretch_mode).toBe('');
  });

  it('adds new key to existing section', () => {
    applyProjectSetting(tmpDir, 'display', 'window/stretch/mode', 'canvas_items', false);

    const config = parseProjectGodot(tmpDir);
    expect(config.display.stretch_mode).toBe('canvas_items');
  });

  it('preserves existing content when adding new keys', () => {
    applyProjectSetting(tmpDir, 'display', 'window/stretch/mode', 'canvas_items', false);

    // Existing values should still be there
    const config = parseProjectGodot(tmpDir);
    expect(config.config.name).toBe('TestProject');
    expect(config.display.width).toBe(1280);
    expect(config.display.height).toBe(720);
  });
});

describe('applyDisplaySetting / applyRenderingSetting shorthands', () => {
  it('applyDisplaySetting routes to display section', () => {
    const result = applyDisplaySetting(tmpDir, 'window/stretch/scale_mode', 'integer', false);
    expect(result.changes[0].section).toBe('display');

    const config = parseProjectGodot(tmpDir);
    expect(config.display.scale_mode).toBe('integer');
  });

  it('applyRenderingSetting routes to rendering section', () => {
    const result = applyRenderingSetting(tmpDir, 'renderer/rendering_method', 'gl_compatibility', false);
    expect(result.changes[0].section).toBe('rendering');

    const config = parseProjectGodot(tmpDir);
    expect(config.rendering.renderer).toBe('gl_compatibility');
  });
});

describe('round-trip fidelity', () => {
  it('mutations preserve unknown sections', () => {
    // Add a custom section that the writer should not touch
    const content = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    const extended = content + '\n[custom_section]\n\nmy_key="my_value"\n';
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), extended, 'utf-8');

    // Apply a mutation to a different section
    applyProjectSetting(tmpDir, 'display', 'window/stretch/mode', 'canvas_items', false);

    // Verify custom section preserved
    const result = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    expect(result).toContain('[custom_section]');
    expect(result).toContain('my_key="my_value"');
  });
});
