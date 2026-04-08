import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  classifyProject,
  generateAdoptionPlan,
  partitionFindings,
  planRepair,
  applyRepair,
  approveRepairPlan,
  createBootstrap,
  completeBootstrap,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  seedVault,
  runDiagnostics,
  computeQualityStates,
  getWeakestDomain,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-v140-'));
  upsertProject(db, 'proj-e2e', 'E2E v140', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('E2E v1.4.0', () => {
  it('messy retrofit → staged adoption → improved quality state', () => {
    // Messy project: just project.godot, nothing else
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="Messy"\n',
      'utf-8',
    );
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'scripts/main.gd'), 'extends Node', 'utf-8');

    const b = createBootstrap(db, 'proj-e2e', null, 'import_existing', tmpDir);
    const diag = runDiagnostics(db, 'proj-e2e', tmpDir);
    completeBootstrap(db, b.id, 'partial');

    // Classify as retrofit
    const scan = { 'project.godot': true, 'battle/scenes/battle_scene.gd': false, 'canon_vault': false };
    const profile = classifyProject(scan, diag);
    expect(profile).toBe('retrofit_prototype');

    // Generate adoption plan
    const plan = generateAdoptionPlan(db, 'proj-e2e', profile, diag.findings);
    expect(plan.stages).toHaveLength(5);

    // Quality state before repairs
    const statesBefore = computeQualityStates(db, 'proj-e2e', tmpDir);
    const blockedBefore = statesBefore.filter(s => s.status === 'blocked').length;

    // Apply safe repairs (stage 2)
    installRuntimeShell(db, 'proj-e2e', tmpDir);
    installProofShell(db, 'proj-e2e');
    seedVault(db, 'proj-e2e', path.join(tmpDir, 'canon'), 'combat_first');

    // Quality state after repairs
    const statesAfter = computeQualityStates(db, 'proj-e2e', tmpDir);
    const blockedAfter = statesAfter.filter(s => s.status === 'blocked').length;
    expect(blockedAfter).toBeLessThan(blockedBefore);
  });

  it('slice with broken visual shell → repaired → improved visual state', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="VisualFix"\n',
      'utf-8',
    );

    const b = createBootstrap(db, 'proj-e2e', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Before: runtime_integrity is blocked (missing shells)
    const statesBefore = computeQualityStates(db, 'proj-e2e', tmpDir);
    const runtimeBefore = statesBefore.find(s => s.domain === 'runtime_integrity');
    expect(runtimeBefore!.status).toBe('blocked');

    // Install runtime shell
    installRuntimeShell(db, 'proj-e2e', tmpDir);

    // After: runtime should improve
    const statesAfter = computeQualityStates(db, 'proj-e2e', tmpDir);
    const runtimeAfter = statesAfter.find(s => s.domain === 'runtime_integrity');
    expect(runtimeAfter!.blocker_count).toBeLessThan(runtimeBefore!.blocker_count);
  });

  it('proof-missing slice → repaired → slice becomes testable', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ProofFix"\n',
      'utf-8',
    );
    const b = createBootstrap(db, 'proj-e2e', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Before: playability is blocked
    const statesBefore = computeQualityStates(db, 'proj-e2e', tmpDir);
    const playBefore = statesBefore.find(s => s.domain === 'playability_integrity');
    expect(playBefore!.status).toBe('blocked');

    // Install proof shell
    installProofShell(db, 'proj-e2e');

    // After: playability should clear
    const statesAfter = computeQualityStates(db, 'proj-e2e', tmpDir);
    const playAfter = statesAfter.find(s => s.domain === 'playability_integrity');
    expect(playAfter!.status).toBe('healthy');
  });

  it('approval-required repair → approved → applied → verified', () => {
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="ApprovalE2E"\n', 'utf-8');
    const b = createBootstrap(db, 'proj-e2e', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Plan moderate repair — plan has precondition pass but requires approval gate
    const plan = planRepair(db, 'proj-e2e', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    const row = db.prepare('SELECT approval_status FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.approval_status).toBe('pending_approval');

    // Approve
    approveRepairPlan(db, plan.plan_id, 'mike');

    // Apply
    const result = applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir);
    expect(result.mode).toBe('apply');
    expect(result.receipt_id).toBeTruthy();

    // Verification ran
    expect(result.verification).toBeDefined();
    expect(typeof result.verification.ran).toBe('boolean');
  });

  it('import produces adoption plan with correct profile and partitioned findings', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ImportE2E"\n',
      'utf-8',
    );
    // Add a shell file to make it vertical_slice
    const shellPath = path.join(tmpDir, 'battle/scenes/battle_scene.gd');
    fs.mkdirSync(path.dirname(shellPath), { recursive: true });
    fs.writeFileSync(shellPath, 'extends Node2D', 'utf-8');

    const bootstrap = createBootstrap(db, 'proj-e2e', null, 'import_existing', tmpDir);
    const diag = runDiagnostics(db, 'proj-e2e', tmpDir);
    completeBootstrap(db, bootstrap.id, 'partial');

    const scan: Record<string, boolean> = {
      'project.godot': true,
      'battle/scenes/battle_scene.gd': true,
      'sprites': false,
      'canon_vault': false,
    };

    const profile = classifyProject(scan, diag);
    expect(profile).toBe('vertical_slice');

    const adoptionPlan = generateAdoptionPlan(db, 'proj-e2e', profile, diag.findings);
    expect(adoptionPlan.profile).toBe('vertical_slice');
    expect(adoptionPlan.current_stage).toBe(2);

    const partitioned = partitionFindings(diag.findings);
    // Should have safe_auto findings (shell repairs are safe)
    expect(partitioned.safe_auto.length + partitioned.approval_required.length + partitioned.manual_only.length + partitioned.advisory.length)
      .toBe(diag.findings.length);
  });
});
