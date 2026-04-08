import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { installRuntimeShell } from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-shell-edge-'));
  upsertProject(db, 'proj-rs', 'Runtime Shell Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runtime shell edge cases', () => {
  it('battle_scene.gd contains documented regions', () => {
    installRuntimeShell(db, 'proj-rs', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'battle/scenes/battle_scene.gd'), 'utf-8');
    expect(content).toContain('## ─── REGIONS');
    expect(content).toContain('## ─── LIFECYCLE');
    expect(content).toContain('## ─── ENCOUNTER LOADING');
    expect(content).toContain('## ─── SPAWNING');
    expect(content).toContain('## ─── GRID');
    expect(content).toContain('## ─── TURN MANAGEMENT');
  });

  it('combat_hud.gd contains panel region stubs', () => {
    installRuntimeShell(db, 'proj-rs', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'battle/scenes/combat_hud.gd'), 'utf-8');
    expect(content).toContain('## ─── PANELS');
    expect(content).toContain('## ─── ACTION MENU');
    expect(content).toContain('## ─── FEEDBACK');
    expect(content).toContain('## ─── BANNERS');
    expect(content).toContain('func show_turn_order');
    expect(content).toContain('func show_damage_popup');
  });

  it('sprite_loader.gd contains DIR_MAP constant', () => {
    installRuntimeShell(db, 'proj-rs', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'battle/scenes/sprite_loader.gd'), 'utf-8');
    expect(content).toContain('const DIR_MAP');
    expect(content).toContain('"front"');
    expect(content).toContain('"front_34"');
    expect(content).toContain('"side"');
    expect(content).toContain('"back"');
    expect(content).toContain('class_name SpriteLoader');
  });

  it('encounter_loader.gd contains load function stub', () => {
    installRuntimeShell(db, 'proj-rs', tmpDir);

    const content = fs.readFileSync(path.join(tmpDir, 'battle/scenes/encounter_loader.gd'), 'utf-8');
    expect(content).toContain('func load_manifest');
    expect(content).toContain('func _normalize');
    expect(content).toContain('class_name EncounterLoader');
    expect(content).toContain('"encounter_id"');
  });

  it('creates assets/sprites and assets/portraits directories', () => {
    installRuntimeShell(db, 'proj-rs', tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'assets', 'sprites'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'assets', 'portraits'))).toBe(true);
    expect(fs.statSync(path.join(tmpDir, 'assets', 'sprites')).isDirectory()).toBe(true);
    expect(fs.statSync(path.join(tmpDir, 'assets', 'portraits')).isDirectory()).toBe(true);
  });
});
