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
  installThemeShell,
  installProofShell,
  seedProjectRegistry,
  seedVault,
  runDiagnostics,
  getProjectStatus,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-e2e-gaps-'));
  upsertProject(db, 'proj-e2g', 'E2E Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair E2E gaps', () => {
  it('messy existing Godot project: import → classify → repair → improved state', () => {
    // Simulate a partially set up project
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="MessyProject"\n',
      'utf-8',
    );
    // Has some files but not all
    const shellPath = path.join(tmpDir, 'battle/scenes/battle_scene.gd');
    fs.mkdirSync(path.dirname(shellPath), { recursive: true });
    fs.writeFileSync(shellPath, 'extends Node2D', 'utf-8');

    const b = createBootstrap(db, 'proj-e2g', null, 'import_existing', tmpDir);
    completeBootstrap(db, b.id, 'partial');

    // Classify: should have findings
    const diagBefore = runDiagnostics(db, 'proj-e2g', tmpDir);
    expect(diagBefore.blocker_count).toBeGreaterThan(0);

    // Repair: install full runtime shell
    installRuntimeShell(db, 'proj-e2g', tmpDir);
    installProofShell(db, 'proj-e2g');
    seedVault(db, 'proj-e2g', path.join(tmpDir, 'canon'), 'combat_first');

    // Re-check: improved
    const diagAfter = runDiagnostics(db, 'proj-e2g', tmpDir);
    expect(diagAfter.blocker_count).toBeLessThan(diagBefore.blocker_count);
  });

  it('classify drift and missing shells correctly in imported project', () => {
    // Project with bad display settings
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      `[application]
config/name="DriftImport"

[autoload]
Custom="*res://custom.gd"

[display]
window/stretch/mode="viewport"
window/stretch/scale_mode="fractional"
`,
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpDir, 'custom.gd'), '# stub', 'utf-8');

    const b = createBootstrap(db, 'proj-e2g', null, 'import_existing', tmpDir);
    completeBootstrap(db, b.id, 'partial');

    const diag = runDiagnostics(db, 'proj-e2g', tmpDir);

    // Should have both shell findings AND display finding
    expect(diag.findings.some(f => f.id.startsWith('shell_'))).toBe(true);
    expect(diag.findings.some(f => f.id === 'display_not_pixel_friendly')).toBe(true);
    expect(diag.findings.some(f => f.id.startsWith('autoload_missing_'))).toBe(true);
  });

  it('apply one safe repair on imported project → re-check shows improvement', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="SafeRepair"\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'proj-e2g', null, 'import_existing', tmpDir);
    completeBootstrap(db, b.id, 'partial');

    const diagBefore = runDiagnostics(db, 'proj-e2g', tmpDir);
    const blockersBefore = diagBefore.blocker_count;

    // Apply one repair via plan system
    const plan = planRepair(db, 'proj-e2g', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-e2g', plan.plan_id, 'apply', tmpDir);

    const diagAfter = runDiagnostics(db, 'proj-e2g', tmpDir);
    expect(diagAfter.blocker_count).toBeLessThan(blockersBefore);
  });

  it('no false "ready" state — partially repaired project never reports ready', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="PartiallyRepaired"\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'proj-e2g', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Install only runtime shell — still missing proof, canon, registry
    installRuntimeShell(db, 'proj-e2g', tmpDir);

    const status = getProjectStatus(db, 'proj-e2g');
    expect(status.status).not.toBe('ready');
    expect(status.warnings.length).toBeGreaterThan(0);
  });
});
