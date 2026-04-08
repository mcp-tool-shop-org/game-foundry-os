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
  installThemeShell,
  installProofShell,
  seedVault,
  seedProjectRegistry,
  runDiagnostics,
} from '@mcptoolshop/studio-bootstrap-core';
import {
  registerAutoload,
  enablePlugin,
  applyDisplaySetting,
  applyRenderingSetting,
} from '@mcptoolshop/engine-bridge-mcp/lib';

let db: Database.Database;
let tmpDir: string;

const PROJECT_GODOT_MINIMAL = `; Minimal Godot project
[application]
config/name="RepairTest"
run/main_scene=""
`;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-godot-loops-'));
  upsertProject(db, 'proj-gl', 'Godot Loops', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeProjectGodot(content: string = PROJECT_GODOT_MINIMAL): void {
  fs.writeFileSync(path.join(tmpDir, 'project.godot'), content, 'utf-8');
}

function fullyPrepare(): void {
  writeProjectGodot();
  installRuntimeShell(db, 'proj-gl', tmpDir);
  installThemeShell(db, 'proj-gl', tmpDir);
  installProofShell(db, 'proj-gl');
  seedProjectRegistry(db, 'proj-gl', 'godot-tactics-template');
  seedVault(db, 'proj-gl', path.join(tmpDir, 'canon'), 'combat_first');
  db.prepare(`
    INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
    VALUES ('gl-p1', 'proj-gl', 'proj-gl-vision', 'project', 'Vision', '/tmp/v.md', 'registered')
  `).run();
  const b = createBootstrap(db, 'proj-gl', null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

describe('Godot-specific repair loops', () => {
  it('missing autoload → register → re-check passes', () => {
    fullyPrepare();

    // Add one custom autoload so the autoload check fires
    registerAutoload(tmpDir, 'SomeCustom', 'res://custom.gd', true, false);
    fs.writeFileSync(path.join(tmpDir, 'custom.gd'), '# stub', 'utf-8');

    // Diagnostics should show missing required autoloads (GameState, etc.)
    const diagBefore = runDiagnostics(db, 'proj-gl', tmpDir);
    const missingAutoloads = diagBefore.findings.filter(f => f.id.startsWith('autoload_missing_'));
    expect(missingAutoloads.length).toBeGreaterThan(0);

    // Register missing autoloads
    registerAutoload(tmpDir, 'GameState', 'res://globals/game_state.gd', true, false);
    registerAutoload(tmpDir, 'SpriteLoader', 'res://globals/sprite_loader.gd', true, false);
    registerAutoload(tmpDir, 'EncounterLoader', 'res://globals/encounter_loader.gd', true, false);
    // Create the actual files
    for (const f of ['globals/game_state.gd', 'globals/sprite_loader.gd', 'globals/encounter_loader.gd']) {
      const fp = path.join(tmpDir, f);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, '# stub', 'utf-8');
    }

    // Re-check should clear autoload findings
    const diagAfter = runDiagnostics(db, 'proj-gl', tmpDir);
    const remainingAutoloads = diagAfter.findings.filter(f => f.id.startsWith('autoload_missing_'));
    expect(remainingAutoloads.length).toBe(0);
  });

  it('display settings applied via writer update project.godot', () => {
    writeProjectGodot();
    installRuntimeShell(db, 'proj-gl', tmpDir);

    // Apply display settings via writer
    applyDisplaySetting(tmpDir, 'window/stretch/mode', 'canvas_items', false);
    applyDisplaySetting(tmpDir, 'window/stretch/scale_mode', 'integer', false);

    // Verify settings were written to project.godot
    const content = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    expect(content).toContain('canvas_items');
    expect(content).toContain('integer');
  });

  it('missing plugin → enable → re-check passes', () => {
    writeProjectGodot();

    // Enable a plugin via writer
    enablePlugin(tmpDir, 'res://addons/foundry/plugin.cfg', false);

    // Verify plugin was added to project.godot
    const content = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    expect(content).toContain('res://addons/foundry/plugin.cfg');
  });

  it('missing export preset → seed preset → export_presets.cfg exists', () => {
    writeProjectGodot();
    installRuntimeShell(db, 'proj-gl', tmpDir);

    // Before: no export_presets.cfg
    const diagBefore = runDiagnostics(db, 'proj-gl', tmpDir);
    const exportFinding = diagBefore.findings.find(f => f.id === 'export_presets_missing');
    expect(exportFinding).toBeDefined();

    // Write an export_presets.cfg manually (simulating repair)
    fs.writeFileSync(
      path.join(tmpDir, 'export_presets.cfg'),
      '[preset.0]\nname="Linux/X11"\nplatform="Linux/X11"\nrunnable=true\n',
      'utf-8',
    );

    // Re-check
    const diagAfter = runDiagnostics(db, 'proj-gl', tmpDir);
    const exportAfter = diagAfter.findings.find(f => f.id === 'export_presets_missing');
    expect(exportAfter).toBeUndefined();
  });

  it('missing proof entrypoint → install → re-check passes', () => {
    writeProjectGodot();
    installRuntimeShell(db, 'proj-gl', tmpDir);

    // Before: proof shell missing
    const diagBefore = runDiagnostics(db, 'proj-gl', tmpDir);
    expect(diagBefore.findings.some(f => f.id === 'proof_shell_missing')).toBe(true);

    // Install proof shell
    installProofShell(db, 'proj-gl');

    // After: proof finding cleared
    const diagAfter = runDiagnostics(db, 'proj-gl', tmpDir);
    expect(diagAfter.findings.some(f => f.id === 'proof_shell_missing')).toBe(false);
  });

  it('missing runtime/theme/proof shell → install → re-check passes', () => {
    writeProjectGodot();

    // Before: all shells missing
    const diagBefore = runDiagnostics(db, 'proj-gl', tmpDir);
    expect(diagBefore.findings.filter(f => f.id.startsWith('shell_')).length).toBeGreaterThan(0);
    expect(diagBefore.findings.some(f => f.id === 'proof_shell_missing')).toBe(true);
    expect(diagBefore.findings.some(f => f.id === 'canon_vault_missing')).toBe(true);

    // Install everything
    installRuntimeShell(db, 'proj-gl', tmpDir);
    installThemeShell(db, 'proj-gl', tmpDir);
    installProofShell(db, 'proj-gl');
    seedVault(db, 'proj-gl', path.join(tmpDir, 'canon'), 'combat_first');

    // After: blockers cleared
    const diagAfter = runDiagnostics(db, 'proj-gl', tmpDir);
    expect(diagAfter.findings.filter(f => f.id.startsWith('shell_')).length).toBe(0);
    expect(diagAfter.findings.some(f => f.id === 'proof_shell_missing')).toBe(false);
    expect(diagAfter.findings.some(f => f.id === 'canon_vault_missing')).toBe(false);
  });
});
