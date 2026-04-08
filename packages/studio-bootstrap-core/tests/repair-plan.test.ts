import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { planRepair, getRepairPlan } from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-rp') {
  upsertProject(db, id, 'Repair Plan Project', tmpDir);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-plan-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('planRepair', () => {
  it('creates a plan for a valid action key', () => {
    seedProject();
    const result = planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    expect(result.plan_id).toMatch(/^rp_/);
    expect(result.action_key).toBe('studio_install_runtime_shell');
    expect(result.finding_ids).toEqual(['shell_battle_scene']);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.expected_effects.length).toBeGreaterThan(0);
    expect(result.plan_fingerprint).toBeTruthy();
    expect(result.can_dry_run).toBe(true);
    expect(result.can_apply).toBe(true);
    expect(result.blockers).toHaveLength(0);
  });

  it('throws for unknown action key', () => {
    seedProject();
    expect(() => planRepair(db, 'proj-rp', ['f1'], 'nonexistent_action', tmpDir, tmpDir))
      .toThrow('Unknown repair action');
  });

  it('stores plan in database', () => {
    seedProject();
    const result = planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    const row = getRepairPlan(db, result.plan_id);
    expect(row).toBeDefined();
    expect(row!.action_key).toBe('studio_install_runtime_shell');
    expect(row!.status).toBe('planned');
    expect(JSON.parse(row!.finding_ids_json)).toEqual(['shell_battle_scene']);
  });

  it('plan fingerprint changes when truth changes', () => {
    seedProject();
    const result1 = planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    // Create project.godot to change the diagnostic truth
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');

    const result2 = planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    expect(result2.plan_fingerprint).not.toBe(result1.plan_fingerprint);
  });

  it('precondition failure blocks planning for godot actions', () => {
    seedProject();
    // No project.godot exists, so godot_register_autoload precondition fails
    const result = planRepair(db, 'proj-rp', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);

    expect(result.precondition_check.passed).toBe(false);
    expect(result.precondition_check.failures).toContain('project.godot not found');
    expect(result.can_apply).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('plan status starts as planned when no blockers', () => {
    seedProject();
    const result = planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    const row = getRepairPlan(db, result.plan_id);
    expect(row!.status).toBe('planned');
  });

  it('plan status starts as escalated when preconditions fail', () => {
    seedProject();
    const result = planRepair(db, 'proj-rp', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);

    const row = getRepairPlan(db, result.plan_id);
    expect(row!.status).toBe('escalated');
  });

  it('steps match expected effects from catalog', () => {
    seedProject();
    const result = planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    expect(result.steps.length).toBe(result.expected_effects.length);
    for (const step of result.steps) {
      expect(step.action).toBe('studio_install_runtime_shell');
      expect(step.risk).toBe('safe');
    }
  });

  it('getRepairPlan returns undefined for nonexistent plan', () => {
    expect(getRepairPlan(db, 'rp_nonexistent')).toBeUndefined();
  });

  it('detects active plan for same finding', () => {
    seedProject();
    planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    // Second plan for the same finding should warn
    const result2 = planRepair(db, 'proj-rp', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    expect(result2.blockers.length).toBeGreaterThan(0);
    expect(result2.blockers[0]).toContain('already has active plan');
  });
});
