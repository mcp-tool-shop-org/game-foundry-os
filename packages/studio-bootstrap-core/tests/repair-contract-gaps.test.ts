import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  REPAIR_CATALOG,
  getRepairContract,
  findingToActionKey,
  planRepair,
  runDiagnostics,
  createBootstrap,
  completeBootstrap,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-contract-gaps-'));
  upsertProject(db, 'proj-cg', 'Contract Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair contract gaps', () => {
  it('payload validation — reject repair plan with missing required fields', () => {
    // planRepair requires valid action_key — empty string should throw
    expect(() => planRepair(db, 'proj-cg', [], '', tmpDir, tmpDir))
      .toThrow();
  });

  it('finding → action mapping completeness — every repairable diagnostic finding has a catalog entry', () => {
    const b = createBootstrap(db, 'proj-cg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const diag = runDiagnostics(db, 'proj-cg', tmpDir);
    const repairableFindings = diag.findings.filter(f => f.repairable && f.repair_action);

    for (const finding of repairableFindings) {
      const mapped = findingToActionKey(finding.repair_action);
      expect(mapped).not.toBeNull();
      const contract = getRepairContract(mapped!);
      expect(contract).toBeDefined();
    }
  });

  it('action_key referenced by at least one finding or studio flow', () => {
    // Every catalog entry should be reachable from at least one finding's repair_action
    // or be a known studio/godot action (some triggered manually, not via diagnostics)
    const studioKeys = [...REPAIR_CATALOG.keys()].filter(k => k.startsWith('studio_'));
    const godotKeys = [...REPAIR_CATALOG.keys()].filter(k => k.startsWith('godot_'));

    // At least some studio keys should be referenced by diagnostic repair_actions
    const b = createBootstrap(db, 'proj-cg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');
    const diag = runDiagnostics(db, 'proj-cg', tmpDir);
    const repairActions = new Set(diag.findings.map(f => f.repair_action).filter(Boolean));

    // Diagnostics-driven studio keys must be reachable
    const diagnosticDriven = studioKeys.filter(k => repairActions.has(k));
    expect(diagnosticDriven.length).toBeGreaterThan(0);

    // All catalog keys (studio + godot) must be valid contracts
    for (const key of [...studioKeys, ...godotKeys]) {
      expect(getRepairContract(key)).toBeDefined();
    }
  });
});
