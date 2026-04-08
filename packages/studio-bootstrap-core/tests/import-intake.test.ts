import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  runDiagnostics,
  createBootstrap,
  completeBootstrap,
  getProjectStatus,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-intake-'));
  upsertProject(db, 'proj-ii', 'Import Intake Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const absPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content, 'utf-8');
}

describe('import existing project intake', () => {
  it('detects existing project.godot as Godot project', () => {
    writeFile('project.godot', '[application]\nconfig/name="Existing"\n');
    const diag = runDiagnostics(db, 'proj-ii', tmpDir);
    // Should NOT have engine_project_godot finding when file exists and valid
    const godotFinding = diag.findings.find(f => f.id === 'engine_project_godot');
    expect(godotFinding).toBeUndefined();
  });

  it('classifies missing battle_scene.gd as missing runtime shell', () => {
    writeFile('project.godot', '[application]\nconfig/name="NoShells"\n');
    const diag = runDiagnostics(db, 'proj-ii', tmpDir);
    const shellFinding = diag.findings.find(f => f.id === 'shell_battle_scene');
    expect(shellFinding).toBeDefined();
    expect(shellFinding!.severity).toBe('critical');
    expect(shellFinding!.repair_action).toBe('studio_install_runtime_shell');
  });

  it('classifies present sprite_loader.gd as compatible', () => {
    writeFile('project.godot', '[application]\nconfig/name="HasLoader"\n');
    writeFile('battle/scenes/sprite_loader.gd', 'class_name SpriteLoader');
    const diag = runDiagnostics(db, 'proj-ii', tmpDir);
    const loaderFinding = diag.findings.find(f => f.id === 'shell_sprite_loader');
    expect(loaderFinding).toBeUndefined(); // No finding = it passed
  });

  it('produces adoption plan with ordered steps', () => {
    writeFile('project.godot', '[application]\nconfig/name="Adoption"\n');
    const diag = runDiagnostics(db, 'proj-ii', tmpDir);
    // repair_candidates is an ordered list of repairs needed
    expect(diag.repair_candidates.length).toBeGreaterThan(0);
    // First repair should be the most critical
    expect(diag.repair_candidates[0]).toMatch(/^studio_/);
  });

  it('does not mark incomplete project as ready', () => {
    writeFile('project.godot', '[application]\nconfig/name="Incomplete"\n');
    const b = createBootstrap(db, 'proj-ii', null, 'import_existing', tmpDir);
    completeBootstrap(db, b.id, 'partial');

    const status = getProjectStatus(db, 'proj-ii');
    expect(status.status).not.toBe('ready');
  });

  it('handles non-Godot directory gracefully', () => {
    // No project.godot — should produce engine_project_godot finding
    const diag = runDiagnostics(db, 'proj-ii', tmpDir);
    expect(diag.pass).toBe(false);
    const godotFinding = diag.findings.find(f => f.id === 'engine_project_godot');
    expect(godotFinding).toBeDefined();
    expect(godotFinding!.severity).toBe('critical');
  });
});
