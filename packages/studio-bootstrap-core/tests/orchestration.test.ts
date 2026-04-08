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
  getStudioNextStep,
  runDiagnostics,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'test-project') {
  upsertProject(db, id, 'Test Project', tmpDir);
}

function fullyBootstrap(projectId = 'test-project') {
  seedProject(projectId);
  installRuntimeShell(db, projectId, tmpDir);
  installThemeShell(db, projectId, tmpDir);
  installProofShell(db, projectId);
  seedProjectRegistry(db, projectId, 'godot-tactics-template');
  seedVault(db, projectId, path.join(tmpDir, 'canon'), 'combat_first');
  db.prepare(`
    INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
    VALUES (?, ?, ?, 'project', 'Vision', '/tmp/v.md', 'registered')
  `).run('orch-p1', projectId, `${projectId}-vision`);
  const b = createBootstrap(db, projectId, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestration-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Project Status with Engine Truth ──────────────────────

describe('project status with engine truth', () => {
  it('returns ready when all shells present and project.godot valid', () => {
    fullyBootstrap();
    const status = getProjectStatus(db, 'test-project');
    expect(status.status).toBe('ready');
    expect(status.engine_truth.project_config_valid).toBe(true);
    expect(status.blockers.length).toBe(0);
  });

  it('returns blocked when runtime shell missing', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    // No runtime shell installed
    const status = getProjectStatus(db, 'test-project');
    expect(status.status).toBe('blocked');
    expect(status.installed_shells.runtime).toBe(false);
    expect(status.missing_shells.length).toBeGreaterThan(0);
  });

  it('returns drifted when autoloads are missing from project.godot', () => {
    seedProject();
    // Write a project.godot with a name and ONE autoload but missing required ones
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="DriftTest"\n\n[autoload]\nSomeCustom="*res://custom.gd"\n',
      'utf-8',
    );
    // Create the autoload file so it doesn't trigger file-missing finding
    fs.writeFileSync(path.join(tmpDir, 'custom.gd'), '# stub', 'utf-8');
    // Create shell files so they pass
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
    installProofShell(db, 'test-project');
    seedProjectRegistry(db, 'test-project', 'godot-tactics-template');
    seedVault(db, 'test-project', path.join(tmpDir, 'canon'), 'combat_first');
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('dp1', 'test-project', 'test-canon', 'project', 'Test', '/tmp/t.md', 'registered')
    `).run();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const status = getProjectStatus(db, 'test-project');
    expect(status.status).toBe('drifted');
    expect(status.engine_truth.missing_autoloads.length).toBeGreaterThan(0);
  });

  it('returns incomplete when no bootstrap record', () => {
    seedProject();
    const status = getProjectStatus(db, 'test-project');
    expect(status.status).toBe('incomplete');
    expect(status.bootstrap_result).toBeNull();
    expect(status.next_step).toBe('bootstrap_template');
  });

  it('includes engine_truth section in output', () => {
    fullyBootstrap();
    const status = getProjectStatus(db, 'test-project');
    expect(status.engine_truth).toBeDefined();
    expect(typeof status.engine_truth.project_config_valid).toBe('boolean');
    expect(typeof status.engine_truth.shell_compliance).toBe('boolean');
    expect(typeof status.engine_truth.autoload_count).toBe('number');
    expect(typeof status.engine_truth.display_width).toBe('number');
    expect(typeof status.engine_truth.display_height).toBe('number');
    expect(Array.isArray(status.engine_truth.missing_autoloads)).toBe(true);
  });

  it('includes installed_shells breakdown', () => {
    fullyBootstrap();
    const status = getProjectStatus(db, 'test-project');
    expect(status.installed_shells).toBeDefined();
    expect(typeof status.installed_shells.canon).toBe('boolean');
    expect(typeof status.installed_shells.registry).toBe('boolean');
    expect(typeof status.installed_shells.runtime).toBe('boolean');
    expect(typeof status.installed_shells.theme).toBe('boolean');
    expect(typeof status.installed_shells.proof).toBe('boolean');
  });

  it('populates repair_candidates when shells missing', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    const status = getProjectStatus(db, 'test-project');
    expect(status.repair_candidates.length).toBeGreaterThan(0);
    expect(status.repair_candidates).toContain('studio_install_runtime_shell');
  });
});

// ─── Diagnostics Blocker Engine ────────────────────────────

describe('diagnostics blocker engine', () => {
  it('produces findings with source_tool field', () => {
    seedProject();
    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.findings.length).toBeGreaterThan(0);
    for (const finding of result.findings) {
      expect(finding.source_tool).toBeTruthy();
      expect(typeof finding.source_tool).toBe('string');
    }
  });

  it('marks missing shell files as critical and repairable', () => {
    seedProject();
    // Only create project.godot, not the shell files
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="Test"\n',
      'utf-8',
    );
    const result = runDiagnostics(db, 'test-project', tmpDir);
    const shellFindings = result.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellFindings.length).toBeGreaterThan(0);
    for (const sf of shellFindings) {
      expect(sf.severity).toBe('critical');
      expect(sf.repairable).toBe(true);
      expect(sf.repair_action).toBe('studio_install_runtime_shell');
    }
  });

  it('marks missing autoloads as major and non-repairable', () => {
    seedProject();
    // Create project.godot with ONE autoload but missing required ones
    // (autoload checks only fire when at least one autoload is configured)
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="Test"\n\n[autoload]\nSomeCustom="*res://custom.gd"\n',
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpDir, 'custom.gd'), '# stub', 'utf-8');

    const result = runDiagnostics(db, 'test-project', tmpDir);
    const autoloadFindings = result.findings.filter(f => f.id.startsWith('autoload_missing_'));
    expect(autoloadFindings.length).toBeGreaterThan(0);
    for (const af of autoloadFindings) {
      expect(af.severity).toBe('major');
      expect(af.repairable).toBe(false);
      expect(af.source_tool).toBe('autoload_contract');
    }
  });

  it('marks import violations as minor', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);

    // Create an .import file with VRAM compression (violation)
    const importDir = path.join(tmpDir, 'assets', 'sprites');
    fs.mkdirSync(importDir, { recursive: true });
    fs.writeFileSync(
      path.join(importDir, 'test.png.import'),
      '[remap]\npath="test"\nimporter="texture"\n\n[params]\ncompress/mode=1\nmipmaps/generate=true\n',
      'utf-8',
    );

    const result = runDiagnostics(db, 'test-project', tmpDir);
    const importFindings = result.findings.filter(f => f.source_tool === 'asset_import_audit');
    expect(importFindings.length).toBeGreaterThan(0);
    for (const imp of importFindings) {
      expect(imp.severity).toBe('minor');
    }
  });

  it('returns pass=true when no critical findings', () => {
    fullyBootstrap();
    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.pass).toBe(true);
    expect(result.blocker_count).toBe(0);
  });

  it('returns repair_candidates for repairable findings', () => {
    seedProject();
    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.repair_candidates.length).toBeGreaterThan(0);
    // All repair candidates should be strings (action keys)
    for (const rc of result.repair_candidates) {
      expect(typeof rc).toBe('string');
      expect(rc.startsWith('studio_')).toBe(true);
    }
  });

  it('handles project with no project.godot gracefully', () => {
    seedProject();
    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.pass).toBe(false);
    const godotFinding = result.findings.find(f => f.id === 'engine_project_godot');
    expect(godotFinding).toBeDefined();
    expect(godotFinding!.severity).toBe('critical');
    expect(godotFinding!.repairable).toBe(true);
  });

  it('detects missing export_presets.cfg', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    const result = runDiagnostics(db, 'test-project', tmpDir);
    const exportFinding = result.findings.find(f => f.id === 'export_presets_missing');
    expect(exportFinding).toBeDefined();
    expect(exportFinding!.severity).toBe('minor');
    expect(exportFinding!.source_tool).toBe('export_audit');
  });
});

// ─── Deterministic Next Step ───────────────────────────────

describe('deterministic next-step', () => {
  it('returns repairable blocker repair action first', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    // V3 domain-aware ordering: proof_shell_missing (playability, weight 0) outranks
    // shell_battle_scene (runtime, weight 1) — both are critical repairable
    const step = getStudioNextStep(db, 'test-project');
    expect(step.priority).toBe('critical');
    expect(step.action).toBe('studio_install_proof_shell');
    expect(step.source).toBeTruthy();
  });

  it('returns missing shell install when shell incomplete', () => {
    seedProject();
    // Write project.godot but not the shell files
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="Test"\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    const step = getStudioNextStep(db, 'test-project');
    // V3 domain-aware ordering: proof_shell_missing (playability, weight 0) outranks
    // shell_ findings (runtime, weight 1) when both are present
    expect(step.action).toBe('studio_install_proof_shell');
  });

  it('returns production move when project ready', () => {
    fullyBootstrap();
    // Add character and encounter
    db.prepare(`
      INSERT INTO characters (id, project_id, display_name)
      VALUES ('char-ns', 'test-project', 'Test Char')
    `).run();
    db.prepare(`
      INSERT INTO encounters (id, project_id, chapter, label)
      VALUES ('enc-ns', 'test-project', 'ch1', 'Test Encounter')
    `).run();
    // V3 engine checks for proof runs before allowing continue_production —
    // add a proof run so it doesn't suggest run_proof_suite
    db.prepare(`
      INSERT INTO proof_runs (id, project_id, scope_type, scope_id, result, blocking_failures, warning_count, receipt_hash)
      VALUES ('pr-ns', 'test-project', 'project', 'test-project', 'pass', 0, 0, 'abc123')
    `).run();
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('continue_production');
    expect(step.priority).toBe('low');
  });

  it('returns exact repair action key, not prose', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    const step = getStudioNextStep(db, 'test-project');
    // Action should be a known action key, not a sentence
    expect(step.action).not.toContain(' is ');
    expect(step.action).not.toContain('please');
    expect(step.action).toMatch(/^[a-z_:]+$/);
  });

  it('handles empty project with correct first step', () => {
    seedProject();
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('bootstrap_template');
    expect(step.priority).toBe('critical');
  });

  it('includes source tool in next step for diagnostic-backed actions', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    const step = getStudioNextStep(db, 'test-project');
    // Diagnostic-backed actions have a source tool
    expect(step.source).toBeTruthy();
  });

  it('returns create_character after all infra ready', () => {
    fullyBootstrap();
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('create_character');
    expect(step.priority).toBe('normal');
  });
});

// ─── Import Existing Project ───────────────────────────────

describe('import existing project', () => {
  it('classifies project with valid project.godot as compatible', () => {
    seedProject();
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ExistingGame"\nrun/main_scene="res://main.tscn"\n',
      'utf-8',
    );
    const diag = runDiagnostics(db, 'test-project', tmpDir);
    // Should NOT have a project.godot finding
    const godotFinding = diag.findings.find(f => f.id === 'engine_project_godot');
    expect(godotFinding).toBeUndefined();
    // engine_project_name should also not be present
    const nameFinding = diag.findings.find(f => f.id === 'engine_project_name');
    expect(nameFinding).toBeUndefined();
  });

  it('identifies missing canon vault', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    const diag = runDiagnostics(db, 'test-project', tmpDir);
    const vaultFinding = diag.findings.find(f => f.id === 'canon_vault_missing');
    expect(vaultFinding).toBeDefined();
    expect(vaultFinding!.repairable).toBe(true);
    expect(vaultFinding!.repair_action).toBe('studio_seed_vault');
  });

  it('identifies missing runtime shell files', () => {
    seedProject();
    // Create project.godot only
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ImportTest"\n',
      'utf-8',
    );
    const diag = runDiagnostics(db, 'test-project', tmpDir);
    const shellFindings = diag.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellFindings.length).toBeGreaterThan(0);
    expect(shellFindings.every(f => f.repair_action === 'studio_install_runtime_shell')).toBe(true);
  });

  it('produces staged adoption plan via repair_candidates', () => {
    seedProject();
    const diag = runDiagnostics(db, 'test-project', tmpDir);
    // Should have repair candidates for shell, vault, proof
    expect(diag.repair_candidates.length).toBeGreaterThan(0);
    // Repair candidates should be deduplicated action keys
    const unique = new Set(diag.repair_candidates);
    expect(unique.size).toBe(diag.repair_candidates.length);
  });

  it('does not pretend incomplete project is clean', () => {
    seedProject();
    // Create only project.godot (no shells, no vault, no proof)
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="IncompleteGame"\n',
      'utf-8',
    );
    const diag = runDiagnostics(db, 'test-project', tmpDir);
    expect(diag.pass).toBe(false);
    expect(diag.blocker_count).toBeGreaterThan(0);
  });
});
