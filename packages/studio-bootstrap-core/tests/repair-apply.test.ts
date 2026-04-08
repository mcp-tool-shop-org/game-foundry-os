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
  runDiagnostics,
  getProjectStatus,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-ra') {
  upsertProject(db, id, 'Repair Apply Project', tmpDir);
}

function seedBootstrap(id = 'proj-ra') {
  const b = createBootstrap(db, id, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-apply-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('applyRepair', () => {
  it('dry-run mode does not create files', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    const result = applyRepair(db, 'proj-ra', plan.plan_id, 'dry_run', tmpDir);

    expect(result.mode).toBe('dry_run');
    expect(result.step_results.length).toBeGreaterThan(0);
    expect(result.step_results.every(s => s.result === 'attempted')).toBe(true);
    expect(result.verification).toBeNull();

    // Files should NOT exist
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/battle_scene.gd'))).toBe(false);
  });

  it('dry-run produces receipt with pass status', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-ra', plan.plan_id, 'dry_run', tmpDir);

    expect(result.receipt_id).toMatch(/^rr_/);
    expect(result.receipt_hash).toBeTruthy();

    // Check DB receipt
    const receipt = db.prepare('SELECT * FROM repair_receipts WHERE id = ?').get(result.receipt_id) as any;
    expect(receipt.status).toBe('pass');
    expect(receipt.mode).toBe('dry_run');
  });

  it('apply mode creates files and produces receipt', () => {
    seedProject();
    seedBootstrap();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir);

    expect(result.mode).toBe('apply');
    expect(result.step_results.some(s => s.result === 'applied')).toBe(true);

    // Files SHOULD exist
    expect(fs.existsSync(path.join(tmpDir, 'battle/scenes/battle_scene.gd'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'project.godot'))).toBe(true);
  });

  it('apply mode runs verification and clears findings', () => {
    seedProject();
    seedBootstrap();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir);

    expect(result.verification).toBeDefined();
    expect(result.verification!.ran).toBe(true);
    expect(result.verification!.findings_cleared.length).toBeGreaterThan(0);
  });

  it('rejects when plan fingerprint is stale', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    // Change truth by creating project.godot
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');

    expect(() => applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir))
      .toThrow('fingerprint mismatch');
  });

  it('rejects plan in terminal state', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    // Manually set status to closed
    db.prepare("UPDATE repair_plans SET status = 'closed' WHERE id = ?").run(plan.plan_id);

    expect(() => applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir))
      .toThrow('Cannot execute plan in status');
  });

  it('emits state event on apply', () => {
    seedProject();
    seedBootstrap();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir);

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'repair' AND entity_id = ?"
    ).all(plan.plan_id) as any[];
    expect(events.length).toBe(1);
    expect(events[0].tool_name).toBe('studio_apply_repair');
  });

  it('does not emit state event on dry_run', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-ra', plan.plan_id, 'dry_run', tmpDir);

    const events = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'repair' AND entity_id = ?"
    ).all(plan.plan_id) as any[];
    expect(events.length).toBe(0);
  });

  it('updates plan status to dry_run_passed after dry-run', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-ra', plan.plan_id, 'dry_run', tmpDir);

    const row = db.prepare('SELECT status FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.status).toBe('dry_run_passed');
  });

  it('updates plan status after apply — verified if no new findings, escalated if new findings appear', () => {
    seedProject();
    seedBootstrap();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir);

    const row = db.prepare('SELECT status FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    // Runtime shell install clears shell findings but other findings may remain or shift.
    // Status is verified (no new findings) or escalated (new findings appeared).
    expect(['verified', 'escalated']).toContain(row.status);

    // The key invariant: shell findings should be cleared
    expect(result.verification!.findings_cleared.length).toBeGreaterThan(0);
  });

  it('can dry-run then apply in sequence', () => {
    seedProject();
    seedBootstrap();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    // Dry-run first
    const dryResult = applyRepair(db, 'proj-ra', plan.plan_id, 'dry_run', tmpDir);
    expect(dryResult.mode).toBe('dry_run');

    // Then apply
    const applyResult = applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir);
    expect(applyResult.mode).toBe('apply');
    expect(applyResult.verification!.ran).toBe(true);
  });

  it('receipt references plan correctly', () => {
    seedProject();
    seedBootstrap();
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-ra', plan.plan_id, 'apply', tmpDir);

    const receipt = db.prepare('SELECT * FROM repair_receipts WHERE id = ?').get(result.receipt_id) as any;
    expect(receipt.plan_id).toBe(plan.plan_id);
    expect(receipt.action_key).toBe('studio_install_runtime_shell');
    expect(receipt.project_id).toBe('proj-ra');
  });

  it('throws for nonexistent plan', () => {
    expect(() => applyRepair(db, 'proj-ra', 'rp_nonexistent', 'apply', tmpDir))
      .toThrow('not found');
  });

  it('throws for plan with wrong project_id', () => {
    seedProject();
    upsertProject(db, 'proj-other', 'Other', '/tmp/other');
    const plan = planRepair(db, 'proj-ra', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    expect(() => applyRepair(db, 'proj-other', plan.plan_id, 'apply', tmpDir))
      .toThrow('belongs to project');
  });
});
