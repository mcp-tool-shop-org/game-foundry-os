import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  createBootstrap,
  completeBootstrap,
  seedProjectRegistry,
  seedVault,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  getProjectStatus,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-sd') {
  upsertProject(db, id, 'Status Defect Project', tmpDir);
}

function fullyBootstrap(id = 'proj-sd') {
  seedProject(id);
  installRuntimeShell(db, id, tmpDir);
  installThemeShell(db, id, tmpDir);
  installProofShell(db, id);
  seedProjectRegistry(db, id, 'godot-tactics-template');
  seedVault(db, id, path.join(tmpDir, 'canon'), 'combat_first');
  db.prepare(`
    INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
    VALUES (?, ?, ?, 'project', 'Vision', '/tmp/v.md', 'registered')
  `).run('sd-p1', id, `${id}-vision`);
  const b = createBootstrap(db, id, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'status-defects-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('project status defect classification', () => {
  it('status=blocked when runtime shell missing', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-sd', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    const status = getProjectStatus(db, 'proj-sd');
    expect(status.status).toBe('blocked');
    expect(status.installed_shells.runtime).toBe(false);
  });

  it('status=drifted when display settings non-integer-scaling', () => {
    seedProject();
    // Write project.godot with non-pixel-friendly display settings + autoload to trigger drift
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="DriftDisplay"\n\n[display]\nwindow/stretch/mode="viewport"\nwindow/stretch/scale_mode="fractional"\n',
      'utf-8',
    );
    // Create all shell files
    for (const file of [
      'battle/scenes/battle_scene.gd',
      'battle/scenes/combat_hud.gd',
      'battle/scenes/sprite_loader.gd',
      'battle/scenes/encounter_loader.gd',
    ]) {
      const fullPath = path.join(tmpDir, file);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '# stub', 'utf-8');
    }
    installProofShell(db, 'proj-sd');
    seedProjectRegistry(db, 'proj-sd', 'godot-tactics-template');
    seedVault(db, 'proj-sd', path.join(tmpDir, 'canon'), 'combat_first');
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('sd-drift', 'proj-sd', 'proj-sd-v', 'project', 'Vision', '/tmp/v.md', 'registered')
    `).run();
    const b = createBootstrap(db, 'proj-sd', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'proj-sd');
    expect(status.status).toBe('drifted');
  });

  it('status=incomplete when no bootstrap record exists', () => {
    seedProject();
    const status = getProjectStatus(db, 'proj-sd');
    expect(status.status).toBe('incomplete');
    expect(status.bootstrap_result).toBeNull();
  });

  it('status=ready when all shells present and engine truth clean', () => {
    fullyBootstrap();
    const status = getProjectStatus(db, 'proj-sd');
    expect(status.status).toBe('ready');
    expect(status.engine_truth.project_config_valid).toBe(true);
    expect(status.engine_truth.shell_compliance).toBe(true);
    expect(status.blockers.length).toBe(0);
  });

  it('missing_shells lists exactly the missing ones', () => {
    seedProject();
    // Create only 2 of 4 required shell files
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="PartialShells"\n',
      'utf-8',
    );
    for (const file of ['battle/scenes/battle_scene.gd', 'battle/scenes/combat_hud.gd']) {
      const fullPath = path.join(tmpDir, file);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, '# stub', 'utf-8');
    }
    const b = createBootstrap(db, 'proj-sd', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'proj-sd');
    expect(status.missing_shells).toHaveLength(2);
    expect(status.missing_shells).toContain('battle/scenes/sprite_loader.gd');
    expect(status.missing_shells).toContain('battle/scenes/encounter_loader.gd');
  });

  it('repair_candidates only includes repairable findings', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-sd', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'proj-sd');
    // All repair candidates should be actionable tool names
    for (const rc of status.repair_candidates) {
      expect(rc).toMatch(/^studio_/);
    }
    expect(status.repair_candidates.length).toBeGreaterThan(0);
  });

  it('engine_truth.project_config_valid reflects project.godot existence', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-sd', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // No project.godot created → config invalid
    const statusNoGodot = getProjectStatus(db, 'proj-sd');
    expect(statusNoGodot.engine_truth.project_config_valid).toBe(false);

    // Create project.godot
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ValidConfig"\n',
      'utf-8',
    );
    const statusWithGodot = getProjectStatus(db, 'proj-sd');
    expect(statusWithGodot.engine_truth.project_config_valid).toBe(true);
  });

  it('engine_truth.shell_compliance reflects shell file presence', () => {
    fullyBootstrap();
    const statusReady = getProjectStatus(db, 'proj-sd');
    expect(statusReady.engine_truth.shell_compliance).toBe(true);

    // Delete a shell file
    fs.unlinkSync(path.join(tmpDir, 'battle/scenes/battle_scene.gd'));
    const statusBroken = getProjectStatus(db, 'proj-sd');
    expect(statusBroken.engine_truth.shell_compliance).toBe(false);
  });
});
