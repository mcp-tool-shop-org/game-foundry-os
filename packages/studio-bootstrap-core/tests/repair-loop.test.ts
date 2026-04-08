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
  runDiagnostics,
  getStudioNextStep,
  getProjectStatus,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-rl') {
  upsertProject(db, id, 'Repair Loop Project', tmpDir);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-loop-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair loop', () => {
  it('diagnostics finds missing runtime shell', () => {
    seedProject();
    const diag = runDiagnostics(db, 'proj-rl', tmpDir);
    const shellFindings = diag.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellFindings.length).toBeGreaterThan(0);
    expect(shellFindings.every(f => f.severity === 'critical')).toBe(true);
  });

  it('next-step returns studio_install_proof_shell (playability domain outranks runtime)', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-rl', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const next = getStudioNextStep(db, 'proj-rl');
    // V3 domain-aware ordering: proof_shell_missing (playability, weight 0) outranks
    // shell_battle_scene (runtime, weight 1)
    expect(next.action).toBe('studio_install_proof_shell');
    expect(next.priority).toBe('critical');
  });

  it('after installing runtime shell, diagnostics clears that blocker', () => {
    seedProject();
    const diagBefore = runDiagnostics(db, 'proj-rl', tmpDir);
    const shellBefore = diagBefore.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellBefore.length).toBeGreaterThan(0);

    installRuntimeShell(db, 'proj-rl', tmpDir);

    const diagAfter = runDiagnostics(db, 'proj-rl', tmpDir);
    const shellAfter = diagAfter.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellAfter.length).toBe(0);
  });

  it('after all repairs, status becomes ready', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-rl', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Apply all repairs
    installRuntimeShell(db, 'proj-rl', tmpDir);
    installThemeShell(db, 'proj-rl', tmpDir);
    installProofShell(db, 'proj-rl');
    seedProjectRegistry(db, 'proj-rl', 'godot-tactics-template');
    seedVault(db, 'proj-rl', path.join(tmpDir, 'canon'), 'combat_first');
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('rl-p1', 'proj-rl', 'proj-rl-vision', 'project', 'Vision', '/tmp/v.md', 'registered')
    `).run();

    const status = getProjectStatus(db, 'proj-rl');
    expect(status.status).toBe('ready');
    expect(status.blockers.length).toBe(0);
  });

  it('bootstrap receipt records repair completion', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-rl', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const row = db.prepare('SELECT * FROM project_bootstraps WHERE id = ?').get(b.id) as any;
    expect(row).toBeDefined();
    expect(row.result).toBe('pass');
    expect(row.project_id).toBe('proj-rl');
  });

  it('re-running diagnostics after fix shows reduced blocker count', () => {
    seedProject();

    const diagBefore = runDiagnostics(db, 'proj-rl', tmpDir);
    const blockersBefore = diagBefore.blocker_count;

    installRuntimeShell(db, 'proj-rl', tmpDir);

    const diagAfter = runDiagnostics(db, 'proj-rl', tmpDir);
    expect(diagAfter.blocker_count).toBeLessThan(blockersBefore);
  });

  it('greenfield project reaches ready after full bootstrap flow', () => {
    seedProject();

    // Step 1: Create bootstrap
    const b = createBootstrap(db, 'proj-rl', null, 'combat_first', tmpDir);

    // Step 2: Install runtime shell
    installRuntimeShell(db, 'proj-rl', tmpDir);

    // Step 3: Install theme shell
    installThemeShell(db, 'proj-rl', tmpDir);

    // Step 4: Install proof shell
    installProofShell(db, 'proj-rl');

    // Step 5: Seed registry
    seedProjectRegistry(db, 'proj-rl', 'godot-tactics-template');

    // Step 6: Seed vault
    seedVault(db, 'proj-rl', path.join(tmpDir, 'canon'), 'combat_first');

    // Step 7: Register canon page
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('rl-green', 'proj-rl', 'proj-rl-v', 'project', 'Vision', '/tmp/v.md', 'registered')
    `).run();

    // Step 8: Complete bootstrap
    completeBootstrap(db, b.id, 'pass');

    // Verify: diagnostics clean
    const diag = runDiagnostics(db, 'proj-rl', tmpDir);
    expect(diag.pass).toBe(true);
    expect(diag.blocker_count).toBe(0);

    // Verify: status ready
    const status = getProjectStatus(db, 'proj-rl');
    expect(status.status).toBe('ready');

    // Verify: next step is production
    const next = getStudioNextStep(db, 'proj-rl');
    expect(['create_character', 'create_encounter', 'continue_production']).toContain(next.action);
  });
});
