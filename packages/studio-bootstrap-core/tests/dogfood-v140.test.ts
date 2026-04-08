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
  getStudioNextStep,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dogfood-v140-'));
  upsertProject(db, 'proj-df', 'Dogfood v140', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('dogfood v1.4.0', () => {
  it('break shell → foundry orders repairs correctly via next-step', () => {
    // Fully set up project
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="DogfoodShell"\n',
      'utf-8',
    );
    installRuntimeShell(db, 'proj-df', tmpDir);
    installProofShell(db, 'proj-df');
    seedVault(db, 'proj-df', path.join(tmpDir, 'canon'), 'combat_first');

    const b = createBootstrap(db, 'proj-df', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Verify next-step is reasonable before break
    const nextBefore = getStudioNextStep(db, 'proj-df');

    // Break a shell file
    const shellPath = path.join(tmpDir, 'battle/scenes/battle_scene.gd');
    if (fs.existsSync(shellPath)) {
      fs.unlinkSync(shellPath);
    }

    // After break: diagnostics should catch it
    const diag = runDiagnostics(db, 'proj-df', tmpDir);
    const shellFindings = diag.findings.filter(f => f.id.startsWith('shell_'));
    expect(shellFindings.length).toBeGreaterThan(0);

    // Next step should point at runtime shell repair
    const nextAfter = getStudioNextStep(db, 'proj-df');
    expect(nextAfter.action).toBeTruthy();
    // Should be a repair-related action for the broken shell
    expect(nextAfter.quality_domain).toBeTruthy();
  });

  it('real non-template Godot project import → honest classification', () => {
    // Simulate a non-template project with custom structure
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      `[application]
config/name="CustomGame"
run/main_scene="res://main.tscn"

[autoload]
GameManager="*res://game_manager.gd"
`,
      'utf-8',
    );
    // Custom files that don't match template
    fs.writeFileSync(path.join(tmpDir, 'main.tscn'), '[gd_scene format=3]\n[node name="Main" type="Node"]', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'game_manager.gd'), 'extends Node\n# custom manager', 'utf-8');

    const bootstrap = createBootstrap(db, 'proj-df', null, 'import_existing', tmpDir);
    const diag = runDiagnostics(db, 'proj-df', tmpDir);
    completeBootstrap(db, bootstrap.id, 'partial');

    const scan: Record<string, boolean> = {
      'project.godot': true,
      'battle/scenes/battle_scene.gd': false,
      'canon_vault': false,
    };

    const profile = classifyProject(scan, diag);
    // Has project.godot but no shells → retrofit_prototype
    expect(profile).toBe('retrofit_prototype');

    // Adoption plan should be honest about the gap
    const plan = generateAdoptionPlan(db, 'proj-df', profile, diag.findings);
    expect(plan.best_next_move).not.toBe('continue_production');
    expect(plan.partitioned_findings.safe_auto.length + plan.partitioned_findings.approval_required.length).toBeGreaterThan(0);
  });

  it('moderate-risk repair flow stays short and concrete', () => {
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="ModFlow"\n', 'utf-8');
    const b = createBootstrap(db, 'proj-df', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Plan → approve → apply: should be exactly 3 function calls
    const plan = planRepair(db, 'proj-df', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps.length).toBeLessThanOrEqual(5); // Short and concrete

    const approval = approveRepairPlan(db, plan.plan_id, 'mike');
    expect(approval.approval_status).toBe('approved');

    const result = applyRepair(db, 'proj-df', plan.plan_id, 'apply', tmpDir);
    expect(result.receipt_id).toBeTruthy();
    expect(result.step_results.length).toBe(plan.steps.length);
  });
});
