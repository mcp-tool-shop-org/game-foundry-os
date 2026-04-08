import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import type { BootstrapDiagnosticResult, DiagnosticFinding } from '@mcptoolshop/game-foundry-registry';
import {
  classifyProject,
  generateAdoptionPlan,
  partitionFindings,
  runDiagnostics,
  createBootstrap,
  completeBootstrap,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  seedVault,
  seedProjectRegistry,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function makeDiag(overrides: Partial<BootstrapDiagnosticResult> = {}): BootstrapDiagnosticResult {
  return {
    project_id: 'proj-ag',
    pass: false,
    findings: [],
    blocker_count: 0,
    warning_count: 0,
    repair_candidates: [],
    next_action: 'project_ready',
    ...overrides,
  };
}

function makeFinding(id: string, severity: 'critical' | 'major' | 'minor', repairAction: string | null = null): DiagnosticFinding {
  return { id, severity, source_tool: 'test', affected_path: '/test', message: `Finding ${id}`, repairable: !!repairAction, repair_action: repairAction };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adoption-gaps-'));
  upsertProject(db, 'proj-ag', 'Adoption Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('adoption gaps', () => {
  it('retrofit prototype classified accurately from real Godot project scan', () => {
    // Real project: has project.godot but no battle shells or canon
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="RetrofitTest"\n',
      'utf-8',
    );
    // Some random GDScript but not the required shells
    fs.mkdirSync(path.join(tmpDir, 'scripts'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'scripts/main.gd'), 'extends Node', 'utf-8');

    const diag = runDiagnostics(db, 'proj-ag', tmpDir);
    const scan: Record<string, boolean> = {
      'project.godot': true,
      'battle/scenes/battle_scene.gd': false,
      'battle/scenes/combat_hud.gd': false,
      'canon_vault': false,
    };

    const profile = classifyProject(scan, diag);
    expect(profile).toBe('retrofit_prototype');

    // Plan should start at stage 1 for retrofit
    const plan = generateAdoptionPlan(db, 'proj-ag', profile, diag.findings);
    expect(plan.profile).toBe('retrofit_prototype');
    expect(plan.current_stage).toBe(1);
  });

  it('active vertical-slice project can be partially adopted without false template purity', () => {
    // Vertical slice: project.godot + some shells present
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="VerticalSlice"\n',
      'utf-8',
    );
    const shellPath = path.join(tmpDir, 'battle/scenes/battle_scene.gd');
    fs.mkdirSync(path.dirname(shellPath), { recursive: true });
    fs.writeFileSync(shellPath, 'extends Node2D\nclass_name BattleScene', 'utf-8');

    const diag = runDiagnostics(db, 'proj-ag', tmpDir);
    const scan: Record<string, boolean> = {
      'project.godot': true,
      'battle/scenes/battle_scene.gd': true,
      'sprites': false,
      'canon_vault': false,
    };

    const profile = classifyProject(scan, diag);
    expect(profile).toBe('vertical_slice');

    const plan = generateAdoptionPlan(db, 'proj-ag', profile, diag.findings);
    // Vertical slice starts at stage 2 — stage 1 is already "completed"
    expect(plan.current_stage).toBe(2);
    expect(plan.stages[0].status).toBe('completed');
    expect(plan.completion.pct).toBe(20);

    // Should not demand template purity — has repair suggestions, not "start over"
    expect(plan.best_next_move).not.toBe('bootstrap_template');
  });

  it('late-stage project adoption focuses on proof + freeze, not shell install', () => {
    // Late stage: everything present, few findings
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="LateStage"\n',
      'utf-8',
    );
    installRuntimeShell(db, 'proj-ag', tmpDir);
    installThemeShell(db, 'proj-ag', tmpDir);
    installProofShell(db, 'proj-ag');
    seedVault(db, 'proj-ag', path.join(tmpDir, 'canon'), 'combat_first');

    const scan: Record<string, boolean> = {
      'project.godot': true,
      'battle/scenes/battle_scene.gd': true,
      'canon_vault': true,
    };
    const diag = makeDiag({ blocker_count: 0, findings: [makeFinding('display_drift', 'minor')] });

    const profile = classifyProject(scan, diag);
    expect(profile).toBe('late_stage_production');

    const plan = generateAdoptionPlan(db, 'proj-ag', profile, diag.findings);
    // Late stage starts at stage 4 (Proof Readiness)
    expect(plan.current_stage).toBe(4);
    expect(plan.stages.filter(s => s.status === 'completed').length).toBe(3);
    // Stage 4 actions should be proof-related
    const stage4 = plan.stages.find(s => s.stage === 4);
    expect(stage4!.actions.some(a => a.includes('proof'))).toBe(true);
  });

  it('import_existing_project returns adoption_profile and adoption_plan in response', () => {
    // Simulate what the MCP tool does
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ImportTest"\n',
      'utf-8',
    );

    const bootstrap = createBootstrap(db, 'proj-ag', null, 'import_existing', tmpDir);
    const scan: Record<string, boolean> = {
      'project.godot': fs.existsSync(path.join(tmpDir, 'project.godot')),
      'battle/scenes/battle_scene.gd': false,
      'canon_vault': false,
    };
    const diag = runDiagnostics(db, 'proj-ag', tmpDir);
    completeBootstrap(db, bootstrap.id, 'partial');

    const profile = classifyProject(scan, diag);
    const adoptionPlan = generateAdoptionPlan(db, 'proj-ag', profile, diag.findings);
    const partitioned = partitionFindings(diag.findings);

    // Verify the response shape matches what the MCP tool returns
    expect(profile).toBeTruthy();
    expect(adoptionPlan.plan_id).toMatch(/^ap_/);
    expect(adoptionPlan.profile).toBe(profile);
    expect(adoptionPlan.stages).toHaveLength(5);
    expect(partitioned.safe_auto).toBeDefined();
    expect(partitioned.approval_required).toBeDefined();
    expect(partitioned.manual_only).toBeDefined();
    expect(partitioned.advisory).toBeDefined();
  });
});
