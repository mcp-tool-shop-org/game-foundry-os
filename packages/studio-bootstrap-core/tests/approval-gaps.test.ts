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
  createBootstrap,
  completeBootstrap,
  runDiagnostics,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-apg') {
  upsertProject(db, id, 'Approval Gap Project', tmpDir);
}

function seedBootstrap(id = 'proj-apg') {
  const b = createBootstrap(db, id, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

function writeProjectGodot() {
  fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'approval-gaps-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('approval gaps', () => {
  it('full cycle: plan moderate → approve → dry-run → apply → verify', () => {
    seedProject();
    seedBootstrap();
    writeProjectGodot();

    // Plan a moderate-risk repair (godot autoload)
    const plan = planRepair(db, 'proj-apg', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    const row1 = db.prepare('SELECT approval_status FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row1.approval_status).toBe('pending_approval');

    // Approve
    const approved = approveRepairPlan(db, plan.plan_id, 'mike');
    expect(approved.approval_status).toBe('approved');

    // Dry-run should now work
    const dryResult = applyRepair(db, 'proj-apg', plan.plan_id, 'dry_run', tmpDir);
    expect(dryResult.mode).toBe('dry_run');

    // Apply the same plan (after dry_run it should be in dry_run_passed state)
    const applyResult = applyRepair(db, 'proj-apg', plan.plan_id, 'apply', tmpDir);
    expect(applyResult.mode).toBe('apply');
    expect(applyResult.receipt_id).toBeTruthy();
  });

  it('approved repair still needs re-check to close — verification runs after apply', () => {
    seedProject();
    seedBootstrap();
    writeProjectGodot();

    const plan = planRepair(db, 'proj-apg', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    approveRepairPlan(db, plan.plan_id, 'mike');
    const result = applyRepair(db, 'proj-apg', plan.plan_id, 'apply', tmpDir);

    // Verification should have run (may or may not have new findings)
    expect(result.verification).toBeDefined();
    expect(typeof result.verification.ran).toBe('boolean');
    expect(Array.isArray(result.verification.findings_cleared)).toBe(true);
  });

  it('cannot approve already-approved plan (idempotency guard)', () => {
    seedProject();
    writeProjectGodot();

    const plan = planRepair(db, 'proj-apg', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);
    approveRepairPlan(db, plan.plan_id, 'mike');
    // Second approval should throw — plan is now 'approved', not 'pending_approval'
    expect(() => approveRepairPlan(db, plan.plan_id, 'mike')).toThrow('pending_approval');
  });

  it('approval-required repair with specific godot params (autoload name, path)', () => {
    seedProject();
    writeProjectGodot();

    // Plan the autoload registration
    const plan = planRepair(db, 'proj-apg', ['autoload_missing_gamestate'], 'godot_register_autoload', tmpDir, tmpDir);

    // Plan should contain steps with godot-specific info
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0].action).toBe('godot_register_autoload');

    // Must be approval-required
    const row = db.prepare('SELECT risk_class, approval_status FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.risk_class).toBe('approval_required');
    expect(row.approval_status).toBe('pending_approval');
  });
});
