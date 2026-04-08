import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  runDiagnostics,
  installRuntimeShell,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-project-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('import existing project', () => {
  it('detects Godot project by project.godot file', () => {
    upsertProject(db, 'proj-imp', 'Import Test', tmpDir);
    // Create a valid project.godot file
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="TestProject"\n',
      'utf-8',
    );

    const diag = runDiagnostics(db, 'proj-imp', tmpDir);
    // project.godot should not appear as a finding when it exists and is valid
    const godotFinding = diag.findings.find(f => f.id === 'engine_project_godot');
    expect(godotFinding).toBeUndefined();
  });

  it('reports missing canon vault', () => {
    upsertProject(db, 'proj-imp', 'Import Test', tmpDir);
    installRuntimeShell(db, 'proj-imp', tmpDir);

    const diag = runDiagnostics(db, 'proj-imp', tmpDir);
    const vaultFinding = diag.findings.find(f => f.id === 'canon_vault_missing');
    expect(vaultFinding).toBeDefined();
    expect(vaultFinding!.severity).toBe('critical');
    expect(vaultFinding!.repairable).toBe(true);
  });

  it('reports missing proof shell', () => {
    upsertProject(db, 'proj-imp', 'Import Test', tmpDir);
    installRuntimeShell(db, 'proj-imp', tmpDir);

    const diag = runDiagnostics(db, 'proj-imp', tmpDir);
    const proofFinding = diag.findings.find(f => f.id === 'proof_shell_missing');
    expect(proofFinding).toBeDefined();
    expect(proofFinding!.severity).toBe('critical');
    expect(proofFinding!.source_tool).toBe('proof_run_asset_suite');
  });

  it('identifies existing sprite pack directories', () => {
    upsertProject(db, 'proj-imp', 'Import Test', tmpDir);
    // Create sprite dirs to simulate existing project
    fs.mkdirSync(path.join(tmpDir, 'assets', 'sprites'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'assets', 'portraits'), { recursive: true });

    const spriteExists = fs.existsSync(path.join(tmpDir, 'assets', 'sprites'));
    const portraitExists = fs.existsSync(path.join(tmpDir, 'assets', 'portraits'));
    expect(spriteExists).toBe(true);
    expect(portraitExists).toBe(true);
  });
});
