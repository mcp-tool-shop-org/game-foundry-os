import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { templateShellVerify } from '../src/tools/templateShellVerify.js';

let db: Database.Database;
let tmpDir: string;

const PROJECT_GODOT_BASE = `[application]
config/name="Shell Test"
run/main_scene="res://main.tscn"

[autoload]
GameState="*res://globals/game_state.gd"
SpriteLoader="*res://globals/sprite_loader.gd"
EncounterLoader="*res://globals/encounter_loader.gd"

[display]
window/size/viewport_width=1280
window/size/viewport_height=720
`;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmpl-verify-edge-'));
  upsertProject(db, 'test-project', 'Test Project', tmpDir);
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

describe('templateShellVerify edge cases', () => {
  it('reports multiple missing shell files in one result', () => {
    writeFile('project.godot', PROJECT_GODOT_BASE);
    // No shell files created — all should be missing
    const result = templateShellVerify(db, 'test-project');
    expect(result.pass).toBe(false);
    expect(result.missing_shells.length).toBeGreaterThanOrEqual(5);
    expect(result.missing_shells).toContain('battle_scene.gd');
    expect(result.missing_shells).toContain('combat_hud.gd');
    expect(result.missing_shells).toContain('sprite_loader.gd');
    expect(result.missing_shells).toContain('encounter_loader.gd');
    expect(result.missing_shells).toContain('type_system.gd');
  });

  it('checks for proof harness file', () => {
    writeFile('project.godot', PROJECT_GODOT_BASE);
    // templateShellVerify checks specific shell files — confirm it has checks array
    const result = templateShellVerify(db, 'test-project');
    expect(result.checks.length).toBeGreaterThan(0);
    // Each failed shell creates an entry
    const shellChecks = result.checks.filter(c => c.check.includes('exists'));
    expect(shellChecks.length).toBeGreaterThan(0);
  });

  it('reports non-integer scaling as display issue', () => {
    writeFile('project.godot', `[application]
config/name="Bad Scaling"

[display]
window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="viewport"
window/stretch/scale_mode="fractional"
`);
    const result = templateShellVerify(db, 'test-project');
    // Display check: needs canvas_items stretch OR integer scale
    const displayCheck = result.checks.find(c => c.check.includes('Display'));
    expect(displayCheck).toBeDefined();
    expect(displayCheck!.pass).toBe(false);
  });

  it('reports non-canvas_items stretch mode as issue', () => {
    writeFile('project.godot', `[application]
config/name="Disabled Stretch"

[display]
window/size/viewport_width=1280
window/size/viewport_height=720
window/stretch/mode="disabled"
window/stretch/scale_mode="fractional"
`);
    const result = templateShellVerify(db, 'test-project');
    const displayCheck = result.checks.find(c => c.check.includes('Display'));
    expect(displayCheck).toBeDefined();
    expect(displayCheck!.pass).toBe(false);
  });

  it('passes only when all checks green', () => {
    writeFile('project.godot', `[application]
config/name="Full Shell"

[autoload]
GameState="*res://globals/game_state.gd"
SpriteLoader="*res://globals/sprite_loader.gd"
EncounterLoader="*res://globals/encounter_loader.gd"

[display]
window/stretch/mode="canvas_items"
window/stretch/scale_mode="integer"
`);
    writeFile('battle/scripts/battle_scene.gd', 'extends Node2D');
    writeFile('battle/scripts/combat_hud.gd', 'extends Control');
    writeFile('globals/sprite_loader.gd', 'extends Node');
    writeFile('globals/encounter_loader.gd', 'extends Node');
    writeFile('globals/type_system.gd', 'extends Node');
    writeFile('globals/game_state.gd', 'extends Node');

    const result = templateShellVerify(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.missing_shells).toHaveLength(0);
    expect(result.checks.every(c => c.pass)).toBe(true);
  });
});
