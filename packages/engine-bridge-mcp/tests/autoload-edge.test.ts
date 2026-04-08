import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { autoloadContract } from '../src/tools/autoloadContract.js';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoload-edge-'));
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

describe('autoloadContract edge cases', () => {
  it('distinguishes singleton vs non-singleton autoloads', () => {
    writeFile('project.godot', `[application]
config/name="Autoload Test"

[autoload]
SingletonOne="*res://globals/singleton_one.gd"
NonSingleton="res://globals/non_singleton.gd"
`);
    writeFile('globals/singleton_one.gd', 'extends Node');
    writeFile('globals/non_singleton.gd', 'extends Node');

    const result = autoloadContract(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.autoloads).toHaveLength(2);

    const singleton = result.autoloads.find(a => a.name === 'SingletonOne');
    expect(singleton!.is_singleton).toBe(true);

    const nonSingleton = result.autoloads.find(a => a.name === 'NonSingleton');
    expect(nonSingleton!.is_singleton).toBe(false);
  });

  it('handles project with no autoloads defined', () => {
    writeFile('project.godot', `[application]
config/name="No Autoloads"
`);
    const result = autoloadContract(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.autoloads).toHaveLength(0);
    expect(result.missing).toHaveLength(0);
  });

  it('reports correct path for each missing autoload', () => {
    writeFile('project.godot', `[application]
config/name="Missing Autoloads"

[autoload]
GameState="*res://globals/game_state.gd"
AudioManager="res://audio/audio_manager.gd"
SaveSystem="*res://save/save_system.gd"
`);
    // Only create one of the three
    writeFile('globals/game_state.gd', 'extends Node');

    const result = autoloadContract(db, 'test-project');
    expect(result.pass).toBe(false);
    expect(result.missing).toHaveLength(2);
    expect(result.missing.some(m => m.includes('audio_manager.gd'))).toBe(true);
    expect(result.missing.some(m => m.includes('save_system.gd'))).toBe(true);
  });
});
