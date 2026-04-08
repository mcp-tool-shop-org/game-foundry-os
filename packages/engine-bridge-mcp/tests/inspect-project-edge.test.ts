import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { inspectProject } from '../src/tools/inspectProject.js';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inspect-proj-edge-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const absPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function seedProject(): void {
  upsertProject(db, 'test-project', 'Test Project', tmpDir);
}

describe('inspectProject edge cases', () => {
  it('returns full project config with all sections', () => {
    seedProject();
    writeFile('project.godot', `; Engine configuration file.

[application]
config/name="Full Config"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.6")

[autoload]
GameState="*res://globals/game_state.gd"

[display]
window/size/viewport_width=1920
window/size/viewport_height=1080
window/stretch/mode="canvas_items"
window/stretch/scale_mode="integer"

[rendering]
renderer/rendering_method="forward_plus"
`);
    const result = inspectProject(db, 'test-project');
    expect(result.project_godot_exists).toBe(true);
    expect(result.config.config.name).toBe('Full Config');
    expect(result.config.run.main_scene).toBe('res://main.tscn');
    expect(result.config.display.width).toBe(1920);
    expect(result.config.rendering.renderer).toBe('forward_plus');
    expect(result.config.autoloads).toHaveLength(1);
  });

  it('throws for nonexistent project_id', () => {
    expect(() => inspectProject(db, 'nonexistent')).toThrow('Project not found');
  });

  it('correctly identifies main_scene absence as issue', () => {
    seedProject();
    writeFile('project.godot', `[application]
config/name="No Main Scene"
`);
    const result = inspectProject(db, 'test-project');
    expect(result.pass).toBe(false);
    const mainCheck = result.checks.find(c => c.check === 'main_scene set');
    expect(mainCheck).toBeDefined();
    expect(mainCheck!.pass).toBe(false);
    expect(mainCheck!.detail).toContain('No main_scene');
  });

  it('extracts logging configuration', () => {
    seedProject();
    writeFile('project.godot', `[application]
config/name="Log Test"
run/main_scene="res://main.tscn"

[autoload]
GameState="*res://g.gd"

[debug]
file_logging/enable_file_logging=true
file_logging/log_path="user://logs/game.log"
`);
    const result = inspectProject(db, 'test-project');
    expect(result.config.logging.file_logging_enabled).toBe(true);
    expect(result.config.logging.log_path).toBe('user://logs/game.log');
  });

  it('handles project.godot with minimal content', () => {
    seedProject();
    writeFile('project.godot', `[application]
config/name="Minimal"
`);
    const result = inspectProject(db, 'test-project');
    expect(result.config.config.name).toBe('Minimal');
    expect(result.config.display.width).toBe(0);
    expect(result.config.display.height).toBe(0);
    expect(result.config.rendering.renderer).toBe('');
    expect(result.config.autoloads).toHaveLength(0);
  });
});
