import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  createBootstrap,
  completeBootstrap,
  installRuntimeShell,
  getProjectStatus,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-truth-snap-'));
  upsertProject(db, 'proj-et', 'Engine Truth Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('engine truth snapshot', () => {
  it('includes display dimensions from project.godot', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="Display"\n\n[display]\nwindow/size/viewport_width=1920\nwindow/size/viewport_height=1080\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'proj-et', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'proj-et');
    expect(status.engine_truth.display_width).toBe(1920);
    expect(status.engine_truth.display_height).toBe(1080);
  });

  it('includes stretch_mode and scale_mode', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="Stretch"\n\n[display]\nwindow/stretch/mode="canvas_items"\nwindow/stretch/scale_mode="integer"\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'proj-et', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'proj-et');
    expect(status.engine_truth.stretch_mode).toBe('canvas_items');
    expect(status.engine_truth.scale_mode).toBe('integer');
  });

  it('includes renderer from project.godot', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="Renderer"\n\n[rendering]\nrenderer/rendering_method="forward_plus"\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'proj-et', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'proj-et');
    expect(status.engine_truth.renderer).toBe('forward_plus');
  });

  it('reports 0 autoloads when project.godot has none', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="NoAutoloads"\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'proj-et', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'proj-et');
    expect(status.engine_truth.autoload_count).toBe(0);
    // missing_autoloads lists required ones not found — all 3 required are missing
    // but deriveStatus treats 0 autoloads as fresh bootstrap, not drift
    expect(status.engine_truth.missing_autoloads).toHaveLength(3);
  });
});
