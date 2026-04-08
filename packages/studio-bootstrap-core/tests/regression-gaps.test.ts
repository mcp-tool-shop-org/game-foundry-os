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
  installProofShell,
  runDiagnostics,
  computeQualityStates,
  getProjectStatus,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'regression-gaps-'));
  upsertProject(db, 'proj-rg', 'Regression Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('regression gaps', () => {
  it('repeated drift in the same domain is surfaced', () => {
    const b = createBootstrap(db, 'proj-rg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // First repair: install runtime shell
    const plan1 = planRepair(db, 'proj-rg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-rg', plan1.plan_id, 'apply', tmpDir);

    // Diagnose after first repair — runtime shells should be clear
    const diag1 = runDiagnostics(db, 'proj-rg', tmpDir);
    const shellFindings1 = diag1.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellFindings1.length).toBe(0);

    // Simulate drift: delete a shell file that was just installed
    const shellPath = path.join(tmpDir, 'battle/scenes/battle_scene.gd');
    if (fs.existsSync(shellPath)) {
      fs.unlinkSync(shellPath);
    }

    // Re-diagnose — should surface the finding again
    const diag2 = runDiagnostics(db, 'proj-rg', tmpDir);
    const shellFindings2 = diag2.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellFindings2.length).toBeGreaterThan(0);
  });

  it('repairs that improve compliance but hurt another domain are caught via regression rows', () => {
    const b = createBootstrap(db, 'proj-rg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Apply runtime shell repair
    const plan = planRepair(db, 'proj-rg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-rg', plan.plan_id, 'apply', tmpDir);

    // Regressions table should be queryable regardless of whether new findings appeared
    const regressions = db.prepare('SELECT * FROM repair_regressions WHERE project_id = ?').all('proj-rg') as any[];
    expect(Array.isArray(regressions)).toBe(true);

    // If there were new findings, they'd be regression rows
    if (result.verification && result.verification.new_findings.length > 0) {
      expect(regressions.length).toBeGreaterThan(0);
      for (const reg of regressions) {
        expect(reg.project_id).toBe('proj-rg');
        expect(reg.regression_type).toBeTruthy();
      }
    }
  });

  it('project status and domain status recompute coherently after repair', () => {
    const b = createBootstrap(db, 'proj-rg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Status before repair
    const statusBefore = getProjectStatus(db, 'proj-rg');
    const statesBefore = computeQualityStates(db, 'proj-rg', tmpDir);
    const runtimeBefore = statesBefore.find(s => s.domain === 'runtime_integrity');
    expect(runtimeBefore!.status).toBe('blocked');

    // Apply runtime shell repair
    const plan = planRepair(db, 'proj-rg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-rg', plan.plan_id, 'apply', tmpDir);

    // Status after repair — should improve
    const statesAfter = computeQualityStates(db, 'proj-rg', tmpDir);
    const runtimeAfter = statesAfter.find(s => s.domain === 'runtime_integrity');
    // Runtime should improve (fewer blockers)
    expect(runtimeAfter!.blocker_count).toBeLessThan(runtimeBefore!.blocker_count);
  });
});
