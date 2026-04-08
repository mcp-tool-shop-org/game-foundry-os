import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import type { BootstrapDiagnosticResult, DiagnosticFinding } from '@mcptoolshop/game-foundry-registry';
import {
  classifyProject,
  partitionFindings,
  generateAdoptionPlan,
  getAdoptionStage,
  advanceAdoptionStage,
  runDiagnostics,
  installRuntimeShell,
  installProofShell,
  seedVault,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-ad') {
  upsertProject(db, id, 'Adoption Project', tmpDir);
}

function makeDiag(overrides: Partial<BootstrapDiagnosticResult> = {}): BootstrapDiagnosticResult {
  return {
    project_id: 'proj-ad',
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adoption-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('classifyProject', () => {
  it('returns greenfield for empty project', () => {
    const scan = { 'project.godot': false, 'canon_vault': false };
    const diag = makeDiag({ blocker_count: 5, findings: [makeFinding('engine_project_godot', 'critical')] });
    expect(classifyProject(scan, diag)).toBe('greenfield');
  });

  it('returns retrofit_prototype when project.godot exists but shells missing', () => {
    const scan = { 'project.godot': true, 'battle/scenes/battle_scene.gd': false, 'canon_vault': false };
    const diag = makeDiag({ blocker_count: 3, findings: [makeFinding('shell_battle_scene', 'critical')] });
    expect(classifyProject(scan, diag)).toBe('retrofit_prototype');
  });

  it('returns vertical_slice when shells present with some content', () => {
    const scan = { 'project.godot': true, 'battle/scenes/battle_scene.gd': true, 'sprites': true };
    const diag = makeDiag({ blocker_count: 2, findings: [makeFinding('canon_vault_missing', 'critical'), makeFinding('proof_shell_missing', 'critical')] });
    expect(classifyProject(scan, diag)).toBe('vertical_slice');
  });

  it('returns late_stage_production when mostly complete', () => {
    const scan = { 'project.godot': true, 'battle/scenes/battle_scene.gd': true, 'canon_vault': true };
    const diag = makeDiag({ blocker_count: 0, findings: [makeFinding('display_drift', 'minor')] });
    expect(classifyProject(scan, diag)).toBe('late_stage_production');
  });
});

describe('partitionFindings', () => {
  it('separates safe_auto from approval_required', () => {
    const findings = [
      makeFinding('shell_battle_scene', 'critical', 'studio_install_runtime_shell'),
      makeFinding('autoload_missing_gs', 'major', 'godot_register_autoload'),
    ];
    const partitioned = partitionFindings(findings);
    expect(partitioned.safe_auto).toContain('shell_battle_scene');
    expect(partitioned.approval_required).toContain('autoload_missing_gs');
  });

  it('puts non-repairable critical/major into manual_only', () => {
    const findings = [makeFinding('autoload_file_missing', 'major')];
    const partitioned = partitionFindings(findings);
    expect(partitioned.manual_only).toContain('autoload_file_missing');
  });

  it('puts minor non-repairable into advisory', () => {
    const findings = [makeFinding('display_not_pixel_friendly', 'minor')];
    const partitioned = partitionFindings(findings);
    expect(partitioned.advisory).toContain('display_not_pixel_friendly');
  });

  it('handles empty findings', () => {
    const partitioned = partitionFindings([]);
    expect(partitioned.safe_auto).toHaveLength(0);
    expect(partitioned.approval_required).toHaveLength(0);
    expect(partitioned.manual_only).toHaveLength(0);
    expect(partitioned.advisory).toHaveLength(0);
  });
});

describe('generateAdoptionPlan', () => {
  it('creates 5 stages', () => {
    seedProject();
    const diag = runDiagnostics(db, 'proj-ad', tmpDir);
    const plan = generateAdoptionPlan(db, 'proj-ad', 'greenfield', diag.findings);
    expect(plan.stages).toHaveLength(5);
  });

  it('greenfield starts at stage 1', () => {
    seedProject();
    const plan = generateAdoptionPlan(db, 'proj-ad', 'greenfield', []);
    expect(plan.current_stage).toBe(1);
  });

  it('vertical_slice starts at stage 2 (skips stage 1)', () => {
    seedProject();
    const plan = generateAdoptionPlan(db, 'proj-ad', 'vertical_slice', []);
    expect(plan.current_stage).toBe(2);
    expect(plan.stages[0].status).toBe('completed'); // stage 1 completed
  });

  it('late_stage starts at stage 4', () => {
    seedProject();
    const plan = generateAdoptionPlan(db, 'proj-ad', 'late_stage_production', []);
    expect(plan.current_stage).toBe(4);
  });

  it('stores plan in DB', () => {
    seedProject();
    const plan = generateAdoptionPlan(db, 'proj-ad', 'greenfield', []);
    const row = db.prepare('SELECT * FROM adoption_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row).toBeDefined();
    expect(row.profile).toBe('greenfield');
  });

  it('computes initial completion', () => {
    seedProject();
    const plan = generateAdoptionPlan(db, 'proj-ad', 'greenfield', []);
    expect(plan.completion.total_stages).toBe(5);
    expect(plan.completion.pct).toBe(0);
  });

  it('vertical_slice shows 20% completion (1 of 5 stages completed)', () => {
    seedProject();
    const plan = generateAdoptionPlan(db, 'proj-ad', 'vertical_slice', []);
    expect(plan.completion.completed_stages).toBe(1);
    expect(plan.completion.pct).toBe(20);
  });

  it('best_next_move points at safe repair when available', () => {
    seedProject();
    const findings = [makeFinding('shell_battle_scene', 'critical', 'studio_install_runtime_shell')];
    const plan = generateAdoptionPlan(db, 'proj-ad', 'retrofit_prototype', findings);
    expect(plan.best_next_move).toBe('studio_install_runtime_shell');
  });

  it('includes partitioned findings', () => {
    seedProject();
    const findings = [
      makeFinding('shell_battle_scene', 'critical', 'studio_install_runtime_shell'),
      makeFinding('display_not_pixel_friendly', 'minor'),
    ];
    const plan = generateAdoptionPlan(db, 'proj-ad', 'retrofit_prototype', findings);
    expect(plan.partitioned_findings.safe_auto).toContain('shell_battle_scene');
    expect(plan.partitioned_findings.advisory).toContain('display_not_pixel_friendly');
  });
});

describe('getAdoptionStage', () => {
  it('returns current stage and actions', () => {
    seedProject();
    generateAdoptionPlan(db, 'proj-ad', 'greenfield', []);
    const result = getAdoptionStage(db, 'proj-ad');
    expect(result).toBeDefined();
    expect(result!.stage.stage).toBe(1);
    expect(result!.next_actions.length).toBeGreaterThan(0);
  });

  it('returns null when no plan exists', () => {
    expect(getAdoptionStage(db, 'nonexistent')).toBeNull();
  });
});

describe('advanceAdoptionStage', () => {
  it('advances from stage 1 to stage 2', () => {
    seedProject();
    generateAdoptionPlan(db, 'proj-ad', 'greenfield', []);
    const advanced = advanceAdoptionStage(db, 'proj-ad');
    expect(advanced).toBeDefined();
    expect(advanced!.current_stage).toBe(2);
  });

  it('returns null when no plan exists', () => {
    expect(advanceAdoptionStage(db, 'nonexistent')).toBeNull();
  });

  it('completion percentage increases after advance', () => {
    seedProject();
    generateAdoptionPlan(db, 'proj-ad', 'greenfield', []);
    const advanced = advanceAdoptionStage(db, 'proj-ad');
    expect(advanced!.completion.completed_stages).toBe(1);
    expect(advanced!.completion.pct).toBe(20);
  });
});
