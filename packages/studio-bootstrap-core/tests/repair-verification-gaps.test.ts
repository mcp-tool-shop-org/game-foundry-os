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
  seedVault,
  seedProjectRegistry,
  runDiagnostics,
  getStudioNextStep,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-verify-gaps-'));
  upsertProject(db, 'proj-vg', 'Verify Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair verification gaps', () => {
  it('new regressions are surfaced as repair_regressions rows', () => {
    const b = createBootstrap(db, 'proj-vg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Plan and apply runtime shell
    const plan = planRepair(db, 'proj-vg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-vg', plan.plan_id, 'apply', tmpDir);

    // Check regressions table — may have 0 if no new findings, but table should be queryable
    const regressions = db.prepare('SELECT * FROM repair_regressions WHERE project_id = ?').all('proj-vg') as any[];
    expect(Array.isArray(regressions)).toBe(true);

    // If there were new findings post-apply, they'd be regression rows
    if (result.verification && result.verification.new_findings.length > 0) {
      expect(regressions.length).toBeGreaterThan(0);
      for (const reg of regressions) {
        expect(reg.regression_type).toBe('repair_introduced');
      }
    }
  });

  it('closed findings disappear from blocker set in next diagnostics run', () => {
    const b = createBootstrap(db, 'proj-vg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Diagnose before
    const diagBefore = runDiagnostics(db, 'proj-vg', tmpDir);
    const shellBefore = diagBefore.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellBefore.length).toBeGreaterThan(0);

    // Apply runtime shell repair
    const plan = planRepair(db, 'proj-vg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-vg', plan.plan_id, 'apply', tmpDir);

    // Diagnose after
    const diagAfter = runDiagnostics(db, 'proj-vg', tmpDir);
    const shellAfter = diagAfter.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellAfter.length).toBe(0);
    expect(diagAfter.blocker_count).toBeLessThan(diagBefore.blocker_count);
  });

  it('next step advances correctly after repair closure', () => {
    const b = createBootstrap(db, 'proj-vg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // V3 domain-aware ordering: proof_shell (playability, weight 0) outranks
    // runtime shell (runtime, weight 1), so install proof shell first
    installProofShell(db, 'proj-vg');

    // Before: next step is now runtime shell (proof shell cleared)
    const nextBefore = getStudioNextStep(db, 'proj-vg');
    expect(nextBefore.action).toBe('studio_install_runtime_shell');

    // Apply runtime shell
    const plan = planRepair(db, 'proj-vg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-vg', plan.plan_id, 'apply', tmpDir);

    // After: next step should advance beyond runtime shell
    const nextAfter = getStudioNextStep(db, 'proj-vg');
    expect(nextAfter.action).not.toBe('studio_install_runtime_shell');
  });
});
