import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  REPAIR_CATALOG,
  planRepair,
  createBootstrap,
  completeBootstrap,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-planning-gaps-'));
  upsertProject(db, 'proj-pg', 'Planning Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair planning gaps', () => {
  it('generates exact plan for each first-wave action (all 5 studio + 5 godot)', () => {
    for (const [key, contract] of REPAIR_CATALOG) {
      // Godot actions need project.godot to exist for preconditions
      if (key.startsWith('godot_')) {
        fs.writeFileSync(
          path.join(tmpDir, 'project.godot'),
          '[application]\nconfig/name="PlanTest"\n',
          'utf-8',
        );
      }

      const plan = planRepair(db, 'proj-pg', [`finding_for_${key}`], key, tmpDir, tmpDir);
      expect(plan.action_key).toBe(key);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.expected_effects).toEqual(contract.expected_effects);
    }
  });

  it('dry-run output deterministic — same inputs produce same plan fingerprint', () => {
    const plan1 = planRepair(db, 'proj-pg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const plan2 = planRepair(db, 'proj-pg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    expect(plan1.plan_fingerprint).toBe(plan2.plan_fingerprint);
  });

  it('multi-step sequencing — compound actions execute steps in order', () => {
    const plan = planRepair(db, 'proj-pg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);

    // Steps should be in ascending step_index order
    for (let i = 0; i < plan.steps.length; i++) {
      expect(plan.steps[i].step_index).toBe(i);
    }
    // Each step has required fields
    for (const step of plan.steps) {
      expect(typeof step.action).toBe('string');
      expect(typeof step.target_path).toBe('string');
      expect(typeof step.expected_change).toBe('string');
    }
  });
});
