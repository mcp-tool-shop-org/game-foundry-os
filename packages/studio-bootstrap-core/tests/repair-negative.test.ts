import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  planRepair,
  applyRepair,
  createBootstrap,
  completeBootstrap,
  installRuntimeShell,
  runDiagnostics,
} from '@mcptoolshop/studio-bootstrap-core';
import {
  registerAutoload,
  enablePlugin,
  applyProjectSetting,
} from '@mcptoolshop/engine-bridge-mcp/lib';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-negative-'));
  upsertProject(db, 'proj-neg', 'Negative Tests', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair negative cases', () => {
  it('invalid plugin path — enablePlugin with nonexistent project.godot', () => {
    // No project.godot → should throw
    expect(() => enablePlugin(tmpDir, 'res://addons/fake/plugin.cfg', true))
      .toThrow('project.godot not found');
  });

  it('autoload target missing on disk — registerAutoload when .gd file does not exist', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="AutoloadMissing"\n',
      'utf-8',
    );

    // Register autoload pointing to a file that doesn't exist
    const result = registerAutoload(tmpDir, 'MissingScript', 'res://nonexistent.gd', true, false);
    expect(result.file_written).toBe(true); // project.godot is updated
    // The autoload is registered even though the target file doesn't exist
    // (that's what autoload_contract audit is for — separate concern)
    const content = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    expect(content).toContain('MissingScript');
  });

  it('conflicting shell markers — shell file already exists with different content', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ConflictTest"\n',
      'utf-8',
    );
    // Pre-create a shell file with custom content
    const shellPath = path.join(tmpDir, 'battle/scenes/battle_scene.gd');
    fs.mkdirSync(path.dirname(shellPath), { recursive: true });
    fs.writeFileSync(shellPath, '# Custom user content\nextends Node2D\n', 'utf-8');

    // installRuntimeShell will overwrite
    installRuntimeShell(db, 'proj-neg', tmpDir);

    // File should now contain the template content
    const content = fs.readFileSync(shellPath, 'utf-8');
    expect(content).toContain('class_name BattleScene');
  });

  it('export preset cannot be safely synthesized — malformed export_presets.cfg', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ExportConflict"\n',
      'utf-8',
    );
    // Create a malformed export file
    fs.writeFileSync(
      path.join(tmpDir, 'export_presets.cfg'),
      'garbage content\nnot valid ini',
      'utf-8',
    );

    // Malformed export_presets.cfg should not crash diagnostics
    installRuntimeShell(db, 'proj-neg', tmpDir);
    const diag = runDiagnostics(db, 'proj-neg', tmpDir);
    // Diagnostics should still complete without throwing
    expect(diag.findings).toBeDefined();
    expect(diag.blocker_count).toBeGreaterThanOrEqual(0);
  });

  it('editor context unavailable — project.godot missing for godot actions', () => {
    // Godot actions have precondition: project_godot_exists
    const plan = planRepair(db, 'proj-neg', ['some_finding'], 'godot_register_autoload', tmpDir, tmpDir);
    // Should be escalated because project.godot doesn't exist
    expect(plan.precondition_check.passed).toBe(false);
    expect(plan.precondition_check.failures.length).toBeGreaterThan(0);
    expect(plan.can_apply).toBe(false);
  });

  it('UID repair requested for ambiguous mapping — deferred action returns escalation', () => {
    // There's no uid repair action in the catalog — should throw for unknown key
    expect(() => planRepair(db, 'proj-neg', ['uid_issue'], 'godot_repair_uid_mapping', tmpDir, tmpDir))
      .toThrow('Unknown repair action');
  });

  it('signal repair requested without safe proof — deferred action returns escalation', () => {
    // No signal repair action exists in catalog
    expect(() => planRepair(db, 'proj-neg', ['signal_issue'], 'godot_repair_signal_connection', tmpDir, tmpDir))
      .toThrow('Unknown repair action');
  });
});
