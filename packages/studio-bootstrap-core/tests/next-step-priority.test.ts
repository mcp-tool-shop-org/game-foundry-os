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
  getStudioNextStep,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-ns') {
  upsertProject(db, id, 'NextStep Project', tmpDir);
}

function fullyBootstrap(id = 'proj-ns') {
  seedProject(id);
  installRuntimeShell(db, id, tmpDir);
  installThemeShell(db, id, tmpDir);
  installProofShell(db, id);
  seedProjectRegistry(db, id, 'godot-tactics-template');
  seedVault(db, id, path.join(tmpDir, 'canon'), 'combat_first');
  db.prepare(`
    INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
    VALUES (?, ?, ?, 'project', 'Vision', '/tmp/v.md', 'registered')
  `).run('ns-p1', id, `${id}-vision`);
  const b = createBootstrap(db, id, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'next-step-prio-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('next-step priority ordering', () => {
  it('repairable critical blocker takes priority over major', () => {
    seedProject();
    // Create project.godot with one autoload (triggers major autoload findings)
    // but no shell files (triggers critical shell findings)
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="PrioTest"\n\n[autoload]\nCustom="*res://custom.gd"\n',
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpDir, 'custom.gd'), '# stub', 'utf-8');
    const b = createBootstrap(db, 'proj-ns', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const next = getStudioNextStep(db, 'proj-ns');
    expect(next.priority).toBe('critical');
    // V3 domain-aware ordering: proof_shell_missing (playability, weight 0) outranks
    // shell_battle_scene (runtime, weight 1)
    expect(next.action).toBe('studio_install_proof_shell');
  });

  it('non-repairable critical takes priority over major', () => {
    seedProject();
    // Empty project.godot → engine_project_name is critical+repairable
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; empty\n', 'utf-8');
    const b = createBootstrap(db, 'proj-ns', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const next = getStudioNextStep(db, 'proj-ns');
    expect(next.priority).toBe('critical');
  });

  it('major takes priority over minor', () => {
    seedProject();
    // Create valid project.godot with autoloads that trigger major findings
    // and all shell files present (no critical findings)
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="MajorTest"\n\n[autoload]\nCustom="*res://custom.gd"\n\n[display]\nwindow/stretch/mode="canvas_items"\n',
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpDir, 'custom.gd'), '# stub', 'utf-8');
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
    // Seed canon + proof so those aren't blockers
    installProofShell(db, 'proj-ns');
    seedProjectRegistry(db, 'proj-ns', 'godot-tactics-template');
    seedVault(db, 'proj-ns', path.join(tmpDir, 'canon'), 'combat_first');
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('ns-mp', 'proj-ns', 'proj-ns-v', 'project', 'Vision', '/tmp/v.md', 'registered')
    `).run();
    const b = createBootstrap(db, 'proj-ns', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const next = getStudioNextStep(db, 'proj-ns');
    // Should be major (autoload missing) not minor (export_presets)
    expect(next.priority).toBe('normal');
    expect(next.source).toBe('autoload_contract');
  });

  it('returns exact repair action key, not description', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-ns', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const next = getStudioNextStep(db, 'proj-ns');
    // Action should be a tool key like studio_install_runtime_shell, not prose
    expect(next.action).toMatch(/^(studio_|fix:|resolve:|create_|continue_|bootstrap_|complete_|retry_)/);
  });

  it('returns source tool for the finding', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-ns', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const next = getStudioNextStep(db, 'proj-ns');
    // For diagnostic-backed next steps, source should be set
    if (next.priority === 'critical' || next.priority === 'normal') {
      expect(next.source).toBeTruthy();
    }
  });

  it('returns bootstrap_template when no bootstrap exists', () => {
    seedProject();
    const next = getStudioNextStep(db, 'proj-ns');
    expect(next.action).toBe('bootstrap_template');
    expect(next.priority).toBe('critical');
    expect(next.source).toBeNull();
  });

  it('returns production suggestion when project fully ready', () => {
    fullyBootstrap();
    const next = getStudioNextStep(db, 'proj-ns');
    // Should suggest creating content (character/encounter) or continue_production
    expect(['create_character', 'create_encounter', 'continue_production']).toContain(next.action);
  });

  it('handles project with 0 findings correctly', () => {
    fullyBootstrap();
    const next = getStudioNextStep(db, 'proj-ns');
    expect(next).toBeDefined();
    expect(next.action).toBeTruthy();
    expect(next.reason).toBeTruthy();
    expect(['normal', 'low']).toContain(next.priority);
  });
});
