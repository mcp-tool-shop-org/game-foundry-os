import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  planRepair,
  applyRepair,
  verifyRepairClosure,
  createBootstrap,
  completeBootstrap,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  seedProjectRegistry,
  seedVault,
  runDiagnostics,
  getProjectStatus,
  getStudioNextStep,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-e2e') {
  upsertProject(db, id, 'E2E Project', tmpDir);
}

function seedBootstrap(id = 'proj-e2e') {
  const b = createBootstrap(db, id, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-e2e-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair closure E2E', () => {
  it('greenfield: detect → plan → dry_run → apply → receipt → findings cleared', () => {
    seedProject();
    seedBootstrap();

    // 1. Detect: runtime shell missing
    const diagBefore = runDiagnostics(db, 'proj-e2e', tmpDir);
    expect(diagBefore.blocker_count).toBeGreaterThan(0);
    expect(diagBefore.repair_candidates).toContain('studio_install_runtime_shell');

    // 2. Plan
    const plan = planRepair(db, 'proj-e2e', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    expect(plan.can_dry_run).toBe(true);
    expect(plan.can_apply).toBe(true);

    // 3. Dry-run
    const dryResult = applyRepair(db, 'proj-e2e', plan.plan_id, 'dry_run', tmpDir);
    expect(dryResult.mode).toBe('dry_run');
    expect(dryResult.step_results.every(s => s.result === 'attempted')).toBe(true);

    // Files should not exist yet
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/battle_scene.gd'))).toBe(false);

    // 4. Apply
    const applyResult = applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir);
    expect(applyResult.mode).toBe('apply');
    expect(applyResult.receipt_id).toMatch(/^rr_/);
    expect(applyResult.receipt_hash).toBeTruthy();

    // Files should exist now
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/battle_scene.gd'))).toBe(true);

    // 5. Shell findings cleared
    expect(applyResult.verification!.ran).toBe(true);
    expect(applyResult.verification!.findings_cleared).toContain('shell_battle_scene');
  });

  it('full greenfield to ready: sequential repairs bring project to ready', () => {
    seedProject();
    seedBootstrap();

    // Apply all repairs manually (not through plan/apply for speed)
    installRuntimeShell(db, 'proj-e2e', tmpDir);
    installThemeShell(db, 'proj-e2e', tmpDir);
    installProofShell(db, 'proj-e2e');
    seedProjectRegistry(db, 'proj-e2e', 'godot-tactics-template');
    seedVault(db, 'proj-e2e', path.join(tmpDir, 'canon'), 'combat_first');

    // Need a canon page for full readiness
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES ('e2e-cp', 'proj-e2e', 'proj-e2e-vision', 'project', 'Vision', '/tmp/v.md', 'registered')
    `).run();

    const status = getProjectStatus(db, 'proj-e2e');
    expect(status.status).toBe('ready');
    expect(status.blockers).toHaveLength(0);

    const next = getStudioNextStep(db, 'proj-e2e');
    expect(['create_character', 'create_encounter', 'continue_production']).toContain(next.action);
  });

  it('stale fingerprint rejection: truth changes between plan and apply', () => {
    seedProject();
    seedBootstrap();

    const plan = planRepair(db, 'proj-e2e', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    // Change truth (create project.godot externally)
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '; Generated\n[application]\nconfig/name="External"\n',
      'utf-8',
    );

    expect(() => applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir))
      .toThrow('fingerprint mismatch');
  });

  it('next-step returns StudioNextStepV3 shape with repair fields and quality domain', () => {
    seedProject();
    seedBootstrap();

    const next = getStudioNextStep(db, 'proj-e2e');
    // V3 domain-aware ordering: proof_shell_missing (playability, weight 0) outranks
    // shell_battle_scene (runtime, weight 1)
    expect(next.action_key).toBe('studio_install_proof_shell');
    expect(next.target).toBe(tmpDir);
    expect(next.can_dry_run).toBe(true);
    expect(next.can_apply).toBe(true);
    expect(next.expected_outcome).toBeTruthy();
    expect(next.priority).toBe('critical');
    // V3 fields
    expect(next.quality_domain).toBe('playability_integrity');
    expect(next.why_it_matters).toBeTruthy();
  });

  it('next-step with no project returns create_project', () => {
    const next = getStudioNextStep(db, 'nonexistent');
    expect(next.action).toBe('create_project');
    expect(next.action_key).toBeNull();
    expect(next.can_dry_run).toBe(false);
  });

  it('plan for proof shell and apply clears proof finding', () => {
    seedProject();
    seedBootstrap();
    installRuntimeShell(db, 'proj-e2e', tmpDir);
    seedVault(db, 'proj-e2e', path.join(tmpDir, 'canon'), 'combat_first');

    // Verify proof shell missing
    const diag = runDiagnostics(db, 'proj-e2e', tmpDir);
    const proofFinding = diag.findings.find(f => f.id === 'proof_shell_missing');
    expect(proofFinding).toBeDefined();
    expect(proofFinding!.repair_action).toBe('studio_install_proof_shell');

    // Plan and apply
    const plan = planRepair(db, 'proj-e2e', ['proof_shell_missing'], 'studio_install_proof_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir);

    expect(result.verification!.findings_cleared).toContain('proof_shell_missing');
  });

  it('plan for vault seed and apply clears canon finding', () => {
    seedProject();
    seedBootstrap();
    installRuntimeShell(db, 'proj-e2e', tmpDir);
    installProofShell(db, 'proj-e2e');

    // Verify canon vault missing
    const diag = runDiagnostics(db, 'proj-e2e', tmpDir);
    const canonFinding = diag.findings.find(f => f.id === 'canon_vault_missing');
    expect(canonFinding).toBeDefined();

    // Plan and apply
    const plan = planRepair(db, 'proj-e2e', ['canon_vault_missing'], 'studio_seed_vault', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir);

    expect(result.verification!.findings_cleared).toContain('canon_vault_missing');
  });

  it('verify closure after apply returns correct result', () => {
    seedProject();
    seedBootstrap();

    const plan = planRepair(db, 'proj-e2e', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const applyResult = applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir);

    const verification = verifyRepairClosure(db, 'proj-e2e', applyResult.receipt_id, tmpDir);
    expect(verification.receipt_id).toBe(applyResult.receipt_id);
    expect(verification.plan_id).toBe(plan.plan_id);
    expect(verification.action_key).toBe('studio_install_runtime_shell');
    expect(verification.findings_cleared.length).toBeGreaterThan(0);
  });

  it('repair receipt stored with correct metadata', () => {
    seedProject();
    seedBootstrap();

    const plan = planRepair(db, 'proj-e2e', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir);

    const receipts = db.prepare('SELECT * FROM repair_receipts WHERE project_id = ?').all('proj-e2e') as any[];
    expect(receipts.length).toBe(1);
    expect(receipts[0].action_key).toBe('studio_install_runtime_shell');
    expect(receipts[0].mode).toBe('apply');
    expect(receipts[0].receipt_hash).toBeTruthy();
    expect(JSON.parse(receipts[0].step_results_json).length).toBeGreaterThan(0);
  });

  it('state event emitted with repair context', () => {
    seedProject();
    seedBootstrap();

    const plan = planRepair(db, 'proj-e2e', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-e2e', plan.plan_id, 'apply', tmpDir);

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'repair'"
    ).all() as any[];
    expect(events.length).toBe(1);
    expect(events[0].entity_id).toBe(plan.plan_id);
    expect(events[0].tool_name).toBe('studio_apply_repair');

    const payload = JSON.parse(events[0].payload_json);
    expect(payload.action_key).toBe('studio_install_runtime_shell');
    expect(payload.receipt_id).toBeTruthy();
  });
});
