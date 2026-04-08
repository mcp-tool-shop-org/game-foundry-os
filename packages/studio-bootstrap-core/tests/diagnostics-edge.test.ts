import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  runDiagnostics,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  seedVault,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-edge-'));
  upsertProject(db, 'proj-de', 'Diagnostics Edge Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('diagnostics edge cases', () => {
  it('fails when godot project file missing', () => {
    const result = runDiagnostics(db, 'proj-de', tmpDir);
    expect(result.pass).toBe(false);
    expect(result.findings.some(f => f.affected_path === 'project.godot')).toBe(true);
  });

  it('fails when canon vault directory missing', () => {
    // Install runtime shell but no canon vault
    installRuntimeShell(db, 'proj-de', tmpDir);
    installThemeShell(db, 'proj-de', tmpDir);
    installProofShell(db, 'proj-de');

    const result = runDiagnostics(db, 'proj-de', tmpDir);
    expect(result.pass).toBe(false);
    expect(result.findings.some(f => f.id === 'canon_vault_missing')).toBe(true);
  });

  it('fails when battle_scene.gd missing', () => {
    // Create project.godot but not the battle scene
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; stub', 'utf-8');

    const result = runDiagnostics(db, 'proj-de', tmpDir);
    expect(result.pass).toBe(false);
    expect(result.findings.some(f => f.affected_path.includes('battle_scene.gd'))).toBe(true);
  });

  it('passes when all components present', () => {
    installRuntimeShell(db, 'proj-de', tmpDir);
    installThemeShell(db, 'proj-de', tmpDir);
    installProofShell(db, 'proj-de');

    // Seed canon vault under canon/ directory
    const canonPath = path.join(tmpDir, 'canon');
    seedVault(db, 'proj-de', canonPath, 'combat_first');

    const result = runDiagnostics(db, 'proj-de', tmpDir);
    expect(result.pass).toBe(true);
    expect(result.blocker_count).toBe(0);
    expect(result.next_action).toBe('project_ready');
  });

  it('reports multiple failures in one diagnostic run', () => {
    // Empty directory — everything should fail
    const result = runDiagnostics(db, 'proj-de', tmpDir);
    expect(result.pass).toBe(false);
    // Should have findings for: project.godot, shell files, canon vault, proof suites
    expect(result.findings.length).toBeGreaterThan(3);

    const criticalFindings = result.findings.filter(f => f.severity === 'critical');
    expect(criticalFindings.length).toBeGreaterThan(2);
  });
});
