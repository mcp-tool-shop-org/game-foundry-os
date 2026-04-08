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
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-receipt-q-'));
  upsertProject(db, 'proj-rq', 'Receipt Quality', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair receipt quality', () => {
  it('receipts are deterministic and diffable', () => {
    const b = createBootstrap(db, 'proj-rq', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const plan = planRepair(db, 'proj-rq', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-rq', plan.plan_id, 'apply', tmpDir);

    // Receipt should have consistent fields
    expect(result.receipt_id).toMatch(/^rr_/);
    expect(result.receipt_hash).toBeTruthy();
    expect(result.receipt_hash.length).toBe(16);
    expect(result.action_key).toBe('studio_install_runtime_shell');
    expect(result.plan_id).toBe(plan.plan_id);
  });

  it('receipts human-readable (JSON structure validation)', () => {
    const b = createBootstrap(db, 'proj-rq', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const plan = planRepair(db, 'proj-rq', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-rq', plan.plan_id, 'apply', tmpDir);

    // Validate stored receipt JSON fields are parseable
    const receipt = db.prepare('SELECT * FROM repair_receipts WHERE project_id = ?').get('proj-rq') as any;
    expect(receipt).toBeDefined();

    const stepResults = JSON.parse(receipt.step_results_json);
    expect(Array.isArray(stepResults)).toBe(true);
    for (const step of stepResults) {
      expect(typeof step.result).toBe('string');
    }

    if (receipt.verification_json) {
      const verification = JSON.parse(receipt.verification_json);
      expect(typeof verification.ran).toBe('boolean');
      expect(Array.isArray(verification.findings_cleared)).toBe(true);
    }

    if (receipt.status_delta_json) {
      const delta = JSON.parse(receipt.status_delta_json);
      expect(typeof delta.from).toBe('string');
      expect(typeof delta.to).toBe('string');
    }
  });

  it('receipt can feed proof/canon/history without redesign', () => {
    const b = createBootstrap(db, 'proj-rq', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const plan = planRepair(db, 'proj-rq', ['proof_shell_missing'], 'studio_install_proof_shell', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-rq', plan.plan_id, 'apply', tmpDir);

    // Receipt contains all fields needed for downstream consumers
    expect(result.receipt_id).toBeTruthy();
    expect(result.action_key).toBeTruthy();
    expect(result.mode).toBe('apply');
    expect(result.step_results.length).toBeGreaterThan(0);

    // Can query receipts by project for history
    const allReceipts = db.prepare(
      'SELECT * FROM repair_receipts WHERE project_id = ? ORDER BY created_at'
    ).all('proj-rq') as any[];
    expect(allReceipts.length).toBe(1);
    expect(allReceipts[0].action_key).toBe('studio_install_proof_shell');

    // Can join to plans for full audit trail
    const planRow = db.prepare(
      'SELECT * FROM repair_plans WHERE id = ?'
    ).get(plan.plan_id) as any;
    expect(planRow).toBeDefined();
    expect(planRow.action_key).toBe('studio_install_proof_shell');
  });
});
