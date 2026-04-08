import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  createBootstrap,
  completeBootstrap,
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
    // Create a project.godot file
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; Godot project', 'utf-8');

    const diag = runDiagnostics(db, 'proj-imp', tmpDir);
    const godotCheck = diag.checks.find(c => c.check === 'runtime:project.godot');
    expect(godotCheck).toBeDefined();
    expect(godotCheck!.pass).toBe(true);
  });

  it('reports missing canon vault', () => {
    upsertProject(db, 'proj-imp', 'Import Test', tmpDir);
    installRuntimeShell(db, 'proj-imp', tmpDir);

    const diag = runDiagnostics(db, 'proj-imp', tmpDir);
    const vaultCheck = diag.checks.find(c => c.check === 'canon:vault_root');
    expect(vaultCheck).toBeDefined();
    expect(vaultCheck!.pass).toBe(false);
    expect(diag.blockers.some(b => b.includes('Canon'))).toBe(true);
  });

  it('reports missing proof shell', () => {
    upsertProject(db, 'proj-imp', 'Import Test', tmpDir);
    installRuntimeShell(db, 'proj-imp', tmpDir);

    const diag = runDiagnostics(db, 'proj-imp', tmpDir);
    const proofCheck = diag.checks.find(c => c.check === 'proof:suites');
    expect(proofCheck).toBeDefined();
    expect(proofCheck!.pass).toBe(false);
    expect(diag.blockers.some(b => b.includes('Proof'))).toBe(true);
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

    // These directories satisfy the directory checks in diagnostics
    const diag = runDiagnostics(db, 'proj-imp', tmpDir);
    const spriteDirCheck = diag.checks.find(c => c.check === 'directory:assets/sprites');
    const portraitDirCheck = diag.checks.find(c => c.check === 'directory:assets/portraits');
    expect(spriteDirCheck!.pass).toBe(true);
    expect(portraitDirCheck!.pass).toBe(true);
  });
});
