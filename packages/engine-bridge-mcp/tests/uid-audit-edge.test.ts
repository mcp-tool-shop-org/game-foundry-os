import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { resourceUidAudit } from '../src/tools/resourceUidAudit.js';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uid-audit-edge-'));
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

describe('resourceUidAudit edge cases', () => {
  it('skips .godot directory during scan', () => {
    // Create a .tscn inside .godot (cache) — should be ignored
    writeFile('.godot/imported/test.tscn', `[gd_scene format=3]
[ext_resource type="Script" path="res://nonexistent.gd" id="1"]
[node name="Root" type="Node2D"]
`);
    // Create a normal scene that's clean
    writeFile('main.tscn', `[gd_scene format=3]
[node name="Root" type="Node2D"]
`);
    const result = resourceUidAudit(db, 'test-project');
    expect(result.audited).toBe(1); // Only main.tscn, not .godot/
    expect(result.pass).toBe(true);
  });

  it('handles scene with no ext_resource entries', () => {
    writeFile('empty.tscn', `[gd_scene format=3]
[node name="Root" type="Node2D"]
`);
    const result = resourceUidAudit(db, 'test-project');
    expect(result.audited).toBe(1);
    expect(result.issues).toHaveLength(0);
    expect(result.pass).toBe(true);
  });

  it('reports multiple missing files from same scene', () => {
    writeFile('multi-ref.tscn', `[gd_scene format=3]
[ext_resource type="Script" path="res://missing1.gd" id="1"]
[ext_resource type="PackedScene" path="res://missing2.tscn" id="2"]
[ext_resource type="Texture2D" path="res://missing3.png" id="3"]
[node name="Root" type="Node2D"]
`);
    const result = resourceUidAudit(db, 'test-project');
    expect(result.pass).toBe(false);
    expect(result.issues.length).toBe(3);
    expect(result.issues.every(i => i.scene === 'multi-ref.tscn')).toBe(true);
  });

  it('handles uid field with different UID formats', () => {
    writeFile('uid-formats.tscn', `[gd_scene format=3]
[ext_resource type="Script" uid="uid://abc123def456" path="res://existing.gd" id="1_long"]
[node name="Root" type="Node2D"]
`);
    writeFile('existing.gd', 'extends Node2D');
    const result = resourceUidAudit(db, 'test-project');
    expect(result.audited).toBe(1);
    expect(result.pass).toBe(true);
  });
});
