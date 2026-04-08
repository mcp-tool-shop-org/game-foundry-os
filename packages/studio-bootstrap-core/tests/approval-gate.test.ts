import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  planRepair,
  applyRepair,
  approveRepairPlan,
  rejectRepairPlan,
  getRepairPlan,
  createBootstrap,
  completeBootstrap,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-ag') {
  upsertProject(db, id, 'Approval Gate Project', tmpDir);
}

function seedBootstrap(id = 'proj-ag') {
  const b = createBootstrap(db, id, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-gate-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('approval gate', () => {
  it('safe plan has approval_status not_required', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ag', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const row = db.prepare('SELECT approval_status, risk_class FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.approval_status).toBe('not_required');
    expect(row.risk_class).toBe('safe_auto');
  });

  it('moderate plan has approval_status pending_approval', () => {
    seedProject();
    // Create project.godot so godot action precondition passes
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    const row = db.prepare('SELECT approval_status, risk_class FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.approval_status).toBe('pending_approval');
    expect(row.risk_class).toBe('approval_required');
  });

  it('approveRepairPlan sets approved status', () => {
    seedProject();
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    const result = approveRepairPlan(db, plan.plan_id, 'mike');
    expect(result.approval_status).toBe('approved');
  });

  it('approveRepairPlan records approved_by and approved_at', () => {
    seedProject();
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    approveRepairPlan(db, plan.plan_id, 'mike');
    const row = db.prepare('SELECT approved_by, approved_at FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.approved_by).toBe('mike');
    expect(row.approved_at).toBeTruthy();
  });

  it('approveRepairPlan rejects if plan is not pending_approval', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ag', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    // Safe plan has not_required status
    expect(() => approveRepairPlan(db, plan.plan_id, 'mike')).toThrow('pending_approval');
  });

  it('rejectRepairPlan sets rejected status', () => {
    seedProject();
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    const result = rejectRepairPlan(db, plan.plan_id, 'Too risky');
    expect(result.approval_status).toBe('rejected');
  });

  it('rejectRepairPlan emits state event', () => {
    seedProject();
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    rejectRepairPlan(db, plan.plan_id, 'Too risky');
    const events = db.prepare("SELECT * FROM state_events WHERE entity_type = 'repair' AND entity_id = ?").all(plan.plan_id) as any[];
    expect(events.length).toBe(1);
    expect(events[0].to_state).toBe('rejected');
  });

  it('applyRepair blocks moderate plan without approval', () => {
    seedProject();
    seedBootstrap();
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    expect(() => applyRepair(db, 'proj-ag', plan.plan_id, 'apply', tmpDir))
      .toThrow('requires approval');
  });

  it('applyRepair allows safe plan without approval', () => {
    seedProject();
    seedBootstrap();
    const plan = planRepair(db, 'proj-ag', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    // Should not throw — safe plans bypass approval
    const result = applyRepair(db, 'proj-ag', plan.plan_id, 'dry_run', tmpDir);
    expect(result.mode).toBe('dry_run');
  });

  it('risk_class stored on plan row', () => {
    seedProject();
    const plan = planRepair(db, 'proj-ag', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const row = db.prepare('SELECT risk_class FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.risk_class).toBe('safe_auto');
  });

  it('cannot approve already-rejected plan', () => {
    seedProject();
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    rejectRepairPlan(db, plan.plan_id, 'No');
    expect(() => approveRepairPlan(db, plan.plan_id, 'mike')).toThrow('pending_approval');
  });

  it('approveRepairPlan with fingerprint validation rejects stale plan', () => {
    seedProject();
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
    const plan = planRepair(db, 'proj-ag', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);

    // Change truth by creating canon vault (removes canon_vault_missing finding, changes fingerprint)
    fs.mkdirSync(path.join(tmpDir, 'canon'), { recursive: true });

    expect(() => approveRepairPlan(db, plan.plan_id, 'mike', tmpDir)).toThrow('stale');
  });
});
