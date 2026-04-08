import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  registerDefaultTemplates,
  createBootstrap,
  completeBootstrap,
  seedProjectRegistry,
  seedVault,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  runDiagnostics,
  getProjectStatus,
  getStudioNextStep,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;
const PROJECT_ID = 'proj-wf';

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-workflow-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('full studio bootstrap workflow', () => {
  it('creates project record', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);

    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(PROJECT_ID) as any;
    expect(row).toBeDefined();
    expect(row.display_name).toBe('Workflow Test');
  });

  it('bootstraps template with all shells', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    const tmpl = registerDefaultTemplates(db);

    const bootstrap = createBootstrap(db, PROJECT_ID, tmpl.id, 'combat_first', tmpDir);
    expect(bootstrap.id).toBeDefined();
    expect(bootstrap.bootstrap_mode).toBe('combat_first');

    installRuntimeShell(db, PROJECT_ID, tmpDir);
    installThemeShell(db, PROJECT_ID, tmpDir);

    completeBootstrap(db, bootstrap.id, 'pass', null);

    const updated = db.prepare('SELECT * FROM project_bootstraps WHERE id = ?').get(bootstrap.id) as any;
    expect(updated.result).toBe('pass');
  });

  it('seeds registry with proof suites and freeze policies', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    const result = seedProjectRegistry(db, PROJECT_ID, 'godot-tactics-template');

    expect(result.suites_created).toBe(5);
    expect(result.policies_created).toBe(3);

    const suites = db.prepare('SELECT * FROM proof_suites WHERE project_id = ?').all(PROJECT_ID);
    expect(suites.length).toBe(5);

    const policies = db.prepare('SELECT * FROM freeze_policies WHERE project_id = ?').all(PROJECT_ID);
    expect(policies.length).toBe(3);
  });

  it('seeds vault with canon pages', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    const canonPath = path.join(tmpDir, 'canon');
    const result = seedVault(db, PROJECT_ID, canonPath, 'combat_first');

    expect(result.pages_created).toBe(8); // 7 base + 1 combat_first
    expect(result.paths.length).toBe(8);

    // Verify key directories created
    expect(fs.existsSync(path.join(canonPath, '00_Project'))).toBe(true);
    expect(fs.existsSync(path.join(canonPath, '01_Chapters'))).toBe(true);
    expect(fs.existsSync(path.join(canonPath, '04_Combat'))).toBe(true);
    expect(fs.existsSync(path.join(canonPath, '05_Art'))).toBe(true);
  });

  it('installs runtime shell with Godot files', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    const result = installRuntimeShell(db, PROJECT_ID, tmpDir);

    expect(result.files_created).toBe(6);
    expect(fs.existsSync(path.join(tmpDir, 'project.godot'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/battle_scene.gd'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/combat_hud.gd'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/sprite_loader.gd'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/encounter_loader.gd'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'tests/proof_harness.gd'))).toBe(true);
  });

  it('installs theme shell', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    installThemeShell(db, PROJECT_ID, tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'assets', 'theme'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'assets', 'fonts'))).toBe(true);

    const typeSystem = path.join(tmpDir, 'assets', 'fonts', 'type_system.gd');
    expect(fs.existsSync(typeSystem)).toBe(true);
    const content = fs.readFileSync(typeSystem, 'utf-8');
    expect(content).toContain('TypeSystem');
  });

  it('installs proof shell', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    const result = installProofShell(db, PROJECT_ID);

    expect(result.suites_created).toBe(5);
    expect(result.policies_created).toBe(3);
  });

  it('diagnostics pass on fully bootstrapped project', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    registerDefaultTemplates(db);

    installRuntimeShell(db, PROJECT_ID, tmpDir);
    installThemeShell(db, PROJECT_ID, tmpDir);
    installProofShell(db, PROJECT_ID);
    seedVault(db, PROJECT_ID, path.join(tmpDir, 'canon'), 'combat_first');

    const diag = runDiagnostics(db, PROJECT_ID, tmpDir);
    expect(diag.pass).toBe(true);
    expect(diag.blockers.length).toBe(0);
  });

  it('project_status shows all components installed', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    const tmpl = registerDefaultTemplates(db);
    const bootstrap = createBootstrap(db, PROJECT_ID, tmpl.id, 'combat_first', tmpDir);

    installRuntimeShell(db, PROJECT_ID, tmpDir);
    installThemeShell(db, PROJECT_ID, tmpDir);
    installProofShell(db, PROJECT_ID);

    // Seed canon pages in DB (simulating vault sync registration)
    const canonPath = path.join(tmpDir, 'canon');
    seedVault(db, PROJECT_ID, canonPath, 'combat_first');
    // Register pages in canon_pages table
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES (?, ?, ?, 'project', 'Vision', ?, 'registered')
    `).run('page-1', PROJECT_ID, `${PROJECT_ID}-vision`, path.join(canonPath, 'vision.md'));

    completeBootstrap(db, bootstrap.id, 'pass', null);

    const status = getProjectStatus(db, PROJECT_ID);
    expect(status.canon_seeded).toBe(true);
    expect(status.registry_seeded).toBe(true);
    expect(status.runtime_shell_installed).toBe(true);
    expect(status.proof_shell_installed).toBe(true);
  });

  it('get_next_step suggests production start after bootstrap', () => {
    upsertProject(db, PROJECT_ID, 'Workflow Test', tmpDir);
    const tmpl = registerDefaultTemplates(db);
    const bootstrap = createBootstrap(db, PROJECT_ID, tmpl.id, 'combat_first', tmpDir);

    installRuntimeShell(db, PROJECT_ID, tmpDir);
    installProofShell(db, PROJECT_ID);
    completeBootstrap(db, bootstrap.id, 'pass', null);

    // Register a canon page so canon is seeded
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES (?, ?, ?, 'project', 'Vision', '/tmp/v.md', 'registered')
    `).run('page-ns', PROJECT_ID, `${PROJECT_ID}-vision`);

    const next = getStudioNextStep(db, PROJECT_ID);
    // After full bootstrap: should suggest creating content (character or encounter)
    expect(next).toBeDefined();
    expect(next.action).toBeDefined();
    expect(next.reason).toBeDefined();
    // Should not suggest bootstrap steps
    expect(next.action).not.toBe('create_project');
    expect(next.action).not.toBe('bootstrap_template');
  });
});
