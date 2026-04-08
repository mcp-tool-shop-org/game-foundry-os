import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  registerTemplate,
  getTemplate,
  listTemplates,
  registerDefaultTemplates,
  createBootstrap,
  completeBootstrap,
  getBootstrap,
  getLatestBootstrap,
  addBootstrapArtifact,
  getBootstrapArtifacts,
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

function seedProject(id = 'test-project') {
  upsertProject(db, id, 'Test Project', tmpDir);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-test-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Templates ──────────────────────────────────────────────

describe('templates', () => {
  it('registers default template', () => {
    const tmpl = registerDefaultTemplates(db);
    expect(tmpl.template_key).toBe('godot-tactics-template');
    expect(tmpl.engine).toBe('godot');
    expect(tmpl.display_name).toBe('Godot Tactics RPG Template');
    expect(tmpl.version).toBe('1.0.0');
  });

  it('gets template by key', () => {
    registerDefaultTemplates(db);
    const tmpl = getTemplate(db, 'godot-tactics-template');
    expect(tmpl).toBeDefined();
    expect(tmpl!.template_key).toBe('godot-tactics-template');
  });

  it('returns undefined for missing template', () => {
    const tmpl = getTemplate(db, 'nonexistent');
    expect(tmpl).toBeUndefined();
  });

  it('lists all templates', () => {
    registerDefaultTemplates(db);
    registerTemplate(db, { template_key: 'test-tmpl', display_name: 'Test', engine: 'godot' });
    const list = listTemplates(db);
    expect(list.length).toBe(2);
  });

  it('upserts on duplicate template_key', () => {
    registerTemplate(db, { template_key: 'test', display_name: 'V1', engine: 'godot' });
    registerTemplate(db, { template_key: 'test', display_name: 'V2', engine: 'godot' });
    const tmpl = getTemplate(db, 'test');
    expect(tmpl!.display_name).toBe('V2');
    expect(listTemplates(db).length).toBe(1);
  });
});

// ─── Bootstrap ──────────────────────────────────────────────

describe('bootstrap', () => {
  it('creates bootstrap record with pending status', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    expect(b.result).toBe('pending');
    expect(b.project_id).toBe('test-project');
    expect(b.bootstrap_mode).toBe('combat_first');
  });

  it('completes bootstrap with pass result', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    const completed = completeBootstrap(db, b.id, 'pass', '{"ok":true}', 'abc123');
    expect(completed.result).toBe('pass');
    expect(completed.receipt_hash).toBe('abc123');
  });

  it('completes bootstrap with fail result', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    const completed = completeBootstrap(db, b.id, 'fail', '{"error":"boom"}');
    expect(completed.result).toBe('fail');
  });

  it('gets bootstrap by id', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    const fetched = getBootstrap(db, b.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(b.id);
  });

  it('adds bootstrap artifacts', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    addBootstrapArtifact(db, b.id, 'runtime_shell', '/tmp/project.godot', 'hash1');
    addBootstrapArtifact(db, b.id, 'canon_page', '/tmp/vision.md', 'hash2');
    const artifacts = getBootstrapArtifacts(db, b.id);
    expect(artifacts.length).toBe(2);
    expect(artifacts[0].artifact_type).toBe('runtime_shell');
    expect(artifacts[1].artifact_type).toBe('canon_page');
  });

  it('gets latest bootstrap for project', () => {
    seedProject();
    const b1 = createBootstrap(db, 'test-project', null, 'blank', tmpDir);
    const b2 = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    const latest = getLatestBootstrap(db, 'test-project');
    expect(latest).toBeDefined();
    // Both created in same instant; just verify one is returned
    expect([b1.id, b2.id]).toContain(latest!.id);
    expect(latest!.project_id).toBe('test-project');
  });

  it('returns undefined for nonexistent project bootstrap', () => {
    const latest = getLatestBootstrap(db, 'nonexistent');
    expect(latest).toBeUndefined();
  });
});

// ─── Seed Registry ──────────────────────────────────────────

describe('seed registry', () => {
  it('creates default proof suites', () => {
    seedProject();
    const result = seedProjectRegistry(db, 'test-project', 'godot-tactics-template');
    expect(result.suites_created).toBe(5);
  });

  it('creates default freeze policies', () => {
    seedProject();
    const result = seedProjectRegistry(db, 'test-project', 'godot-tactics-template');
    expect(result.policies_created).toBe(3);
  });

  it('is idempotent', () => {
    seedProject();
    seedProjectRegistry(db, 'test-project', 'godot-tactics-template');
    const result2 = seedProjectRegistry(db, 'test-project', 'godot-tactics-template');
    expect(result2.suites_created).toBe(0);
    expect(result2.policies_created).toBe(0);
  });
});

// ─── Seed Vault ─────────────────────────────────────────────

describe('seed vault', () => {
  it('creates vault directory structure', () => {
    seedProject();
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'test-project', vaultPath, 'combat_first');
    expect(fs.existsSync(path.join(vaultPath, '00_Project'))).toBe(true);
    expect(fs.existsSync(path.join(vaultPath, '01_Chapters'))).toBe(true);
    expect(fs.existsSync(path.join(vaultPath, '04_Combat'))).toBe(true);
    expect(fs.existsSync(path.join(vaultPath, '05_Art'))).toBe(true);
  });

  it('creates vision.md with valid frontmatter', () => {
    seedProject();
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'test-project', vaultPath, 'combat_first');
    const content = fs.readFileSync(path.join(vaultPath, '00_Project', 'vision.md'), 'utf-8');
    expect(content).toContain('---');
    expect(content).toContain('id: test-project-vision');
    expect(content).toContain('kind: project');
    expect(content).toContain('# Project Vision');
  });

  it('creates chapter stub with frontmatter', () => {
    seedProject();
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'test-project', vaultPath, 'combat_first');
    const content = fs.readFileSync(path.join(vaultPath, '01_Chapters', 'ch1.md'), 'utf-8');
    expect(content).toContain('kind: chapter');
    expect(content).toContain('chapter: 1');
  });

  it('combat_first mode creates extra pages', () => {
    seedProject();
    const vaultPath = path.join(tmpDir, 'canon');
    const result = seedVault(db, 'test-project', vaultPath, 'combat_first');
    expect(result.pages_created).toBe(8); // 7 base + 1 combat_first extra
    expect(fs.existsSync(path.join(vaultPath, '04_Combat', 'encounter-patterns.md'))).toBe(true);
  });

  it('blank mode does not create combat extra pages', () => {
    seedProject();
    const vaultPath = path.join(tmpDir, 'canon');
    const result = seedVault(db, 'test-project', vaultPath, 'blank');
    expect(result.pages_created).toBe(7);
    expect(fs.existsSync(path.join(vaultPath, '04_Combat', 'encounter-patterns.md'))).toBe(false);
  });
});

// ─── Install Runtime Shell ──────────────────────────────────

describe('install runtime shell', () => {
  it('creates Godot project file', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'project.godot'))).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, 'project.godot'), 'utf-8');
    expect(content).toContain('[application]');
  });

  it('creates battle_scene.gd with regions', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'battle', 'scenes', 'battle_scene.gd'), 'utf-8');
    expect(content).toContain('class_name BattleScene');
    expect(content).toContain('REGIONS');
    expect(content).toContain('func load_encounter');
  });

  it('creates combat_hud.gd shell', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'battle', 'scenes', 'combat_hud.gd'), 'utf-8');
    expect(content).toContain('class_name CombatHud');
    expect(content).toContain('func show_turn_order');
  });

  it('creates sprite_loader.gd', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'battle', 'scenes', 'sprite_loader.gd'), 'utf-8');
    expect(content).toContain('class_name SpriteLoader');
    expect(content).toContain('DIR_MAP');
  });

  it('creates encounter_loader.gd', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'battle', 'scenes', 'encounter_loader.gd'), 'utf-8');
    expect(content).toContain('class_name EncounterLoader');
    expect(content).toContain('func load_manifest');
  });

  it('creates asset directories', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'assets', 'sprites'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'assets', 'portraits'))).toBe(true);
  });

  it('returns correct file count', () => {
    seedProject();
    const result = installRuntimeShell(db, 'test-project', tmpDir);
    expect(result.files_created).toBe(6);
    expect(result.paths.length).toBe(6);
  });
});

// ─── Install Theme ──────────────────────────────────────────

describe('install theme', () => {
  it('creates type_system.gd', () => {
    seedProject();
    installThemeShell(db, 'test-project', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'assets', 'fonts', 'type_system.gd'), 'utf-8');
    expect(content).toContain('class_name TypeSystem');
    expect(content).toContain('COLOR_BG_PRIMARY');
  });

  it('creates theme directory', () => {
    seedProject();
    installThemeShell(db, 'test-project', tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'assets', 'theme'))).toBe(true);
  });
});

// ─── Install Proof Shell ────────────────────────────────────

describe('install proof shell', () => {
  it('creates proof suites in registry', () => {
    seedProject();
    const result = installProofShell(db, 'test-project');
    expect(result.suites_created).toBe(5);
  });

  it('creates freeze policies in registry', () => {
    seedProject();
    const result = installProofShell(db, 'test-project');
    expect(result.policies_created).toBe(3);
  });
});

// ─── Diagnostics ────────────────────────────────────────────

describe('diagnostics', () => {
  it('passes when all components present', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    installThemeShell(db, 'test-project', tmpDir);
    installProofShell(db, 'test-project');

    // Seed vault
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'test-project', vaultPath, 'combat_first');

    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.pass).toBe(true);
    expect(result.blockers.length).toBe(0);
  });

  it('fails when runtime shell missing', () => {
    seedProject();
    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.pass).toBe(false);
    expect(result.blockers.some(b => b.includes('runtime'))).toBe(true);
  });

  it('reports missing canon pages', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    installThemeShell(db, 'test-project', tmpDir);
    installProofShell(db, 'test-project');
    // No vault seeded
    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.pass).toBe(false);
    expect(result.blockers.some(b => b.includes('Canon'))).toBe(true);
  });

  it('reports missing proof shell', () => {
    seedProject();
    installRuntimeShell(db, 'test-project', tmpDir);
    installThemeShell(db, 'test-project', tmpDir);
    const vaultPath = path.join(tmpDir, 'canon');
    seedVault(db, 'test-project', vaultPath, 'combat_first');
    // No proof shell
    const result = runDiagnostics(db, 'test-project', tmpDir);
    expect(result.pass).toBe(false);
    expect(result.blockers.some(b => b.includes('Proof'))).toBe(true);
  });
});

// ─── Project Status ─────────────────────────────────────────

describe('project status', () => {
  it('returns correct status for bootstrapped project', () => {
    seedProject();
    const tmpl = registerDefaultTemplates(db);
    const b = createBootstrap(db, 'test-project', tmpl.id, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    seedProjectRegistry(db, 'test-project', 'godot-tactics-template');

    const status = getProjectStatus(db, 'test-project');
    expect(status.bootstrap_result).toBe('pass');
    expect(status.template_used).toBe('godot-tactics-template');
    expect(status.registry_seeded).toBe(true);
    expect(status.proof_shell_installed).toBe(true);
  });

  it('returns correct status for unbootstrapped project', () => {
    seedProject();
    const status = getProjectStatus(db, 'test-project');
    expect(status.bootstrap_result).toBeNull();
    expect(status.next_step).toBe('bootstrap_template');
  });
});

// ─── Next Step ──────────────────────────────────────────────

describe('next step', () => {
  it('suggests create_project for missing project', () => {
    const step = getStudioNextStep(db, 'nonexistent');
    expect(step.action).toBe('create_project');
    expect(step.priority).toBe('critical');
  });

  it('suggests bootstrap_template for new project', () => {
    seedProject();
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('bootstrap_template');
  });

  it('suggests seed_vault when vault missing', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('seed_vault');
  });

  it('suggests install_proof_shell when suites missing', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    // Add a fake canon page
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('p1', 'test-project', 'test-canon', 'project', 'Test', '/tmp/test.md', 'registered')
    `).run();
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('install_proof_shell');
  });

  it('suggests continue_production when fully set up', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    seedProjectRegistry(db, 'test-project', 'godot-tactics-template');
    // Add canon page
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('p1', 'test-project', 'test-canon', 'project', 'Test', '/tmp/test.md', 'registered')
    `).run();
    // Add character
    db.prepare(`
      INSERT INTO characters (id, project_id, display_name)
      VALUES ('char1', 'test-project', 'Test Character')
    `).run();
    // Add encounter
    db.prepare(`
      INSERT INTO encounters (id, project_id, chapter, label)
      VALUES ('enc1', 'test-project', 'ch1', 'Test Encounter')
    `).run();
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('continue_production');
    expect(step.priority).toBe('low');
  });

  it('suggests retry_bootstrap on failed bootstrap', () => {
    seedProject();
    const b = createBootstrap(db, 'test-project', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'fail');
    const step = getStudioNextStep(db, 'test-project');
    expect(step.action).toBe('retry_bootstrap');
    expect(step.priority).toBe('critical');
  });
});
