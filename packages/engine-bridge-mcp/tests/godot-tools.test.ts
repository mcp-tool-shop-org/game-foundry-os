import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { parseProjectGodot, parseGodotValue, parseIniSections } from '../src/utils/godot-project.js';
import { parseScene } from '../src/utils/godot-scene.js';
import { parseImportFile, auditImportSettings } from '../src/utils/godot-import.js';
import { inspectProject } from '../src/tools/inspectProject.js';
import { templateShellVerify } from '../src/tools/templateShellVerify.js';
import { autoloadContract } from '../src/tools/autoloadContract.js';
import { exportAudit } from '../src/tools/exportAudit.js';
import { signalContractAudit } from '../src/tools/signalContractAudit.js';
import { resourceUidAudit } from '../src/tools/resourceUidAudit.js';
import { assetImportAudit } from '../src/tools/assetImportAudit.js';
import { sceneGraph } from '../src/tools/sceneGraph.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let tmpDir: string;

const PROJECT_GODOT = `; Engine configuration file.
; It's best edited using the editor UI and not directly.

[application]
config/name="Test Project"
run/main_scene="res://battle/scenes/battle_scene.tscn"
config/features=PackedStringArray("4.6")

[autoload]
GameState="*res://globals/game_state.gd"
AudioManager="res://globals/audio_manager.gd"

[display]
window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="canvas_items"
window/stretch/scale_mode="integer"

[editor_plugins]
enabled=PackedStringArray("res://addons/foundry/plugin.cfg")

[rendering]
renderer/rendering_method="gl_compatibility"
`;

const SCENE_TSCN = `[gd_scene uid="uid://abc123" format=3]

[ext_resource type="Script" uid="uid://def456" path="res://battle/scripts/battle_scene.gd" id="1_abc"]
[ext_resource type="PackedScene" path="res://battle/hud/combat_hud.tscn" id="2_def"]

[sub_resource type="StyleBoxFlat" id="StyleBoxFlat_abc"]

[node name="BattleScene" type="Node2D"]
script = ExtResource("1_abc")

[node name="HUD" type="Control" parent="."]

[node name="EnemyContainer" type="Node2D" parent="."]

[connection signal="pressed" from="HUD" to="." method="_on_hud_pressed"]
[connection signal="tree_exited" from="EnemyContainer" to="." method="_on_enemy_exited" flags=3]
`;

const IMPORT_GOOD = `[remap]
importer="texture"
type="CompressedTexture2D"
path="res://.godot/imported/front.png-abc.ctex"

[params]
compress/mode=0
mipmaps/generate=false
process/fix_alpha_border=true
detect_3d/compress_to="disabled"
`;

const IMPORT_BAD = `[remap]
importer="texture"
type="CompressedTexture2D"
path="res://.godot/imported/front.png-abc.ctex"

[params]
compress/mode=2
mipmaps/generate=true
detect_3d/compress_to="vram_compressed"
`;

const EXPORT_PRESETS = `[preset.0]
name="Linux/X11"
platform="Linux/X11"
runnable=true

[preset.0.options]
custom_template/debug=""

[preset.1]
name="Windows Desktop"
platform="Windows Desktop"
runnable=false
`;

function writeFile(relPath: string, content: string): void {
  const absPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function seedProject(): void {
  upsertProject(db, 'test-project', 'Test Project', tmpDir);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-tools-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── parseGodotValue ───────────────────────────────────────

describe('parseGodotValue', () => {
  it('parses PackedStringArray', () => {
    const result = parseGodotValue('PackedStringArray("4.6", "GL Compatibility")');
    expect(result).toEqual(['4.6', 'GL Compatibility']);
  });

  it('parses quoted strings', () => {
    expect(parseGodotValue('"canvas_items"')).toBe('canvas_items');
  });

  it('parses booleans', () => {
    expect(parseGodotValue('true')).toBe(true);
    expect(parseGodotValue('false')).toBe(false);
  });

  it('parses numbers', () => {
    expect(parseGodotValue('1280')).toBe(1280);
  });

  it('parses Vector2i', () => {
    expect(parseGodotValue('Vector2i(3, 5)')).toEqual({ x: 3, y: 5 });
  });
});

// ─── parseProjectGodot ─────────────────────────────────────

describe('parseProjectGodot', () => {
  it('parses project name from config section', () => {
    writeFile('project.godot', PROJECT_GODOT);
    const config = parseProjectGodot(tmpDir);
    expect(config.config.name).toBe('Test Project');
  });

  it('extracts autoloads with singleton flag', () => {
    writeFile('project.godot', PROJECT_GODOT);
    const config = parseProjectGodot(tmpDir);
    expect(config.autoloads).toHaveLength(2);
    expect(config.autoloads[0]).toEqual({
      name: 'GameState',
      path: 'res://globals/game_state.gd',
      is_singleton: true,
    });
    expect(config.autoloads[1]).toEqual({
      name: 'AudioManager',
      path: 'res://globals/audio_manager.gd',
      is_singleton: false,
    });
  });

  it('extracts editor plugins from PackedStringArray', () => {
    writeFile('project.godot', PROJECT_GODOT);
    const config = parseProjectGodot(tmpDir);
    expect(config.editor_plugins).toEqual(['res://addons/foundry/plugin.cfg']);
  });

  it('extracts display settings', () => {
    writeFile('project.godot', PROJECT_GODOT);
    const config = parseProjectGodot(tmpDir);
    expect(config.display.width).toBe(1280);
    expect(config.display.height).toBe(720);
    expect(config.display.stretch_mode).toBe('canvas_items');
    expect(config.display.scale_mode).toBe('integer');
  });

  it('returns empty defaults for missing project.godot', () => {
    const config = parseProjectGodot(tmpDir);
    expect(config.config.name).toBe('');
    expect(config.autoloads).toHaveLength(0);
    expect(config.display.width).toBe(0);
  });

  it('extracts rendering method', () => {
    writeFile('project.godot', PROJECT_GODOT);
    const config = parseProjectGodot(tmpDir);
    expect(config.rendering.renderer).toBe('gl_compatibility');
  });
});

// ─── parseScene ────────────────────────────────────────────

describe('parseScene', () => {
  it('parses ext_resource entries with uid', () => {
    writeFile('test.tscn', SCENE_TSCN);
    const scene = parseScene(path.join(tmpDir, 'test.tscn'));
    expect(scene.ext_resources).toHaveLength(2);
    expect(scene.ext_resources[0]).toEqual({
      id: '1_abc',
      type: 'Script',
      path: 'res://battle/scripts/battle_scene.gd',
      uid: 'uid://def456',
    });
  });

  it('parses node tree with parent paths', () => {
    writeFile('test.tscn', SCENE_TSCN);
    const scene = parseScene(path.join(tmpDir, 'test.tscn'));
    expect(scene.nodes).toHaveLength(3);
    expect(scene.nodes[0].name).toBe('BattleScene');
    expect(scene.nodes[0].type).toBe('Node2D');
    expect(scene.nodes[1].parent).toBe('.');
    expect(scene.nodes[2].name).toBe('EnemyContainer');
  });

  it('parses connection entries', () => {
    writeFile('test.tscn', SCENE_TSCN);
    const scene = parseScene(path.join(tmpDir, 'test.tscn'));
    expect(scene.connections).toHaveLength(2);
    expect(scene.connections[0]).toEqual({
      signal: 'pressed',
      from: 'HUD',
      to: '.',
      method: '_on_hud_pressed',
    });
    expect(scene.connections[1].flags).toBe(3);
  });

  it('parses uid and format from scene header', () => {
    writeFile('test.tscn', SCENE_TSCN);
    const scene = parseScene(path.join(tmpDir, 'test.tscn'));
    expect(scene.uid).toBe('uid://abc123');
    expect(scene.format).toBe(3);
  });

  it('parses sub_resource entries', () => {
    writeFile('test.tscn', SCENE_TSCN);
    const scene = parseScene(path.join(tmpDir, 'test.tscn'));
    expect(scene.sub_resources).toHaveLength(1);
    expect(scene.sub_resources[0].type).toBe('StyleBoxFlat');
  });

  it('handles empty scene', () => {
    const scene = parseScene(path.join(tmpDir, 'nonexistent.tscn'));
    expect(scene.nodes).toHaveLength(0);
    expect(scene.ext_resources).toHaveLength(0);
    expect(scene.uid).toBeNull();
  });
});

// ─── parseImportFile ───────────────────────────────────────

describe('parseImportFile', () => {
  it('extracts source_file and importer', () => {
    writeFile('test.png.import', IMPORT_GOOD);
    const data = parseImportFile(path.join(tmpDir, 'test.png.import'));
    expect(data.importer).toBe('texture');
    expect(data.compress_mode).toBe(0);
  });

  it('detects VRAM compression as pixel-art violation', () => {
    writeFile('test.png.import', IMPORT_BAD);
    const data = parseImportFile(path.join(tmpDir, 'test.png.import'));
    expect(data.compress_mode).toBe(2);
    expect(data.mipmaps).toBe(true);
  });
});

// ─── auditImportSettings ──────────────────────────────────

describe('auditImportSettings', () => {
  it('passes for Lossless compressed 2D assets', () => {
    writeFile('assets/sprites/front.png.import', IMPORT_GOOD);
    const result = auditImportSettings(tmpDir);
    expect(result.pass).toBe(true);
    expect(result.files_checked).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  it('fails for VRAM compressed pixel art', () => {
    writeFile('assets/sprites/front.png.import', IMPORT_BAD);
    const result = auditImportSettings(tmpDir);
    expect(result.pass).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(i => i.issue.includes('VRAM compression'))).toBe(true);
  });
});

// ─── templateShellVerify ──────────────────────────────────

describe('templateShellVerify', () => {
  it('passes when all shell files present', () => {
    seedProject();
    writeFile('project.godot', PROJECT_GODOT);
    // Add required autoloads
    writeFile('project.godot', PROJECT_GODOT.replace(
      '[autoload]\nGameState="*res://globals/game_state.gd"\nAudioManager="res://globals/audio_manager.gd"',
      '[autoload]\nGameState="*res://globals/game_state.gd"\nSpriteLoader="*res://globals/sprite_loader.gd"\nEncounterLoader="*res://globals/encounter_loader.gd"',
    ));
    writeFile('battle/scripts/battle_scene.gd', 'extends Node2D');
    writeFile('battle/scripts/combat_hud.gd', 'extends Control');
    writeFile('globals/sprite_loader.gd', 'extends Node');
    writeFile('globals/encounter_loader.gd', 'extends Node');
    writeFile('globals/type_system.gd', 'extends Node');

    const result = templateShellVerify(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.missing_shells).toHaveLength(0);
  });

  it('fails when battle_scene.gd missing', () => {
    seedProject();
    writeFile('project.godot', PROJECT_GODOT);
    const result = templateShellVerify(db, 'test-project');
    expect(result.pass).toBe(false);
    expect(result.missing_shells).toContain('battle_scene.gd');
  });

  it('checks display settings for pixel art', () => {
    seedProject();
    writeFile('project.godot', PROJECT_GODOT);
    const result = templateShellVerify(db, 'test-project');
    // Display check should pass since project.godot has canvas_items stretch mode
    const displayCheck = result.checks.find(c => c.check.includes('Display'));
    expect(displayCheck).toBeDefined();
    expect(displayCheck!.pass).toBe(true);
  });
});

// ─── autoloadContract ─────────────────────────────────────

describe('autoloadContract', () => {
  it('reports missing autoload script files', () => {
    seedProject();
    writeFile('project.godot', PROJECT_GODOT);
    // Don't create the actual .gd files — they should be reported as missing
    const result = autoloadContract(db, 'test-project');
    expect(result.pass).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('passes when all autoloads resolve', () => {
    seedProject();
    writeFile('project.godot', PROJECT_GODOT);
    writeFile('globals/game_state.gd', 'extends Node');
    writeFile('globals/audio_manager.gd', 'extends Node');
    const result = autoloadContract(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.autoloads).toHaveLength(2);
    expect(result.autoloads[0].is_singleton).toBe(true);
  });
});

// ─── exportAudit ──────────────────────────────────────────

describe('exportAudit', () => {
  it('fails when export_presets.cfg missing', () => {
    seedProject();
    const result = exportAudit(db, 'test-project');
    expect(result.pass).toBe(false);
    expect(result.issues.some(i => i.issue.includes('not found'))).toBe(true);
  });

  it('passes when at least one preset exists', () => {
    seedProject();
    writeFile('export_presets.cfg', EXPORT_PRESETS);
    const result = exportAudit(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.presets).toHaveLength(2);
    expect(result.presets[0].name).toBe('Linux/X11');
    expect(result.presets[1].platform).toBe('Windows Desktop');
  });
});

// ─── signalContractAudit ──────────────────────────────────

describe('signalContractAudit', () => {
  it('passes when all connection targets exist in scene', () => {
    seedProject();
    writeFile('test.tscn', SCENE_TSCN);
    const result = signalContractAudit(db, 'test-project', 'test.tscn');
    expect(result.pass).toBe(true);
    expect(result.connections).toHaveLength(2);
  });

  it('reports missing target nodes', () => {
    seedProject();
    const badScene = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="pressed" from="NonExistent" to="." method="_on_pressed"]
`;
    writeFile('bad.tscn', badScene);
    const result = signalContractAudit(db, 'test-project', 'bad.tscn');
    expect(result.pass).toBe(false);
    expect(result.issues.some(i => i.issue.includes('not found'))).toBe(true);
  });
});

// ─── resourceUidAudit ─────────────────────────────────────

describe('resourceUidAudit', () => {
  it('reports missing referenced files', () => {
    seedProject();
    writeFile('test.tscn', SCENE_TSCN);
    // The ext_resources reference files that don't exist
    const result = resourceUidAudit(db, 'test-project');
    expect(result.audited).toBe(1);
    expect(result.pass).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('passes when all referenced files exist', () => {
    seedProject();
    writeFile('test.tscn', SCENE_TSCN);
    writeFile('battle/scripts/battle_scene.gd', 'extends Node2D');
    writeFile('battle/hud/combat_hud.tscn', '[gd_scene format=3]');
    const result = resourceUidAudit(db, 'test-project');
    expect(result.pass).toBe(true);
  });
});

// ─── sceneGraph ───────────────────────────────────────────

describe('sceneGraph', () => {
  it('returns parsed scene data', () => {
    seedProject();
    writeFile('test.tscn', SCENE_TSCN);
    const result = sceneGraph(db, 'test-project', 'test.tscn');
    expect(result.scene.nodes).toHaveLength(3);
    expect(result.scene.ext_resources).toHaveLength(2);
    expect(result.scene.connections).toHaveLength(2);
  });
});

// ─── assetImportAudit ─────────────────────────────────────

describe('assetImportAudit', () => {
  it('reports VRAM compression violations', () => {
    seedProject();
    writeFile('project.godot', PROJECT_GODOT);
    writeFile('assets/sprites/front.png.import', IMPORT_BAD);
    const result = assetImportAudit(db, 'test-project');
    expect(result.overall_pass).toBe(false);
    expect(result.audit.issues.length).toBeGreaterThan(0);
  });

  it('passes for clean pixel-art imports', () => {
    seedProject();
    writeFile('project.godot', PROJECT_GODOT);
    writeFile('assets/sprites/front.png.import', IMPORT_GOOD);
    const result = assetImportAudit(db, 'test-project');
    expect(result.overall_pass).toBe(true);
    expect(result.project_settings.stretch_mode).toBe('canvas_items');
  });
});
