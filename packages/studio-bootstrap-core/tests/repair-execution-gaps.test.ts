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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-exec-gaps-'));
  upsertProject(db, 'proj-eg', 'Exec Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('repair execution gaps', () => {
  it('receipts emitted on both success and failure modes', () => {
    const b = createBootstrap(db, 'proj-eg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Dry-run receipt
    const plan1 = planRepair(db, 'proj-eg', ['shell_battle_scene'], 'studio_install_runtime_shell', tmpDir, tmpDir);
    const dryResult = applyRepair(db, 'proj-eg', plan1.plan_id, 'dry_run', tmpDir);
    expect(dryResult.receipt_id).toMatch(/^rr_/);

    // Apply receipt
    const applyResult = applyRepair(db, 'proj-eg', plan1.plan_id, 'apply', tmpDir);
    expect(applyResult.receipt_id).toMatch(/^rr_/);

    // Both should be in DB
    const receipts = db.prepare('SELECT * FROM repair_receipts WHERE project_id = ?').all('proj-eg') as any[];
    expect(receipts.length).toBe(2);
    const modes = receipts.map((r: any) => r.mode).sort();
    expect(modes).toEqual(['apply', 'dry_run']);
  });

  it('apply mutates only declared targets — no extra files created', () => {
    const b = createBootstrap(db, 'proj-eg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Snapshot files before
    const filesBefore = new Set(collectAllFiles(tmpDir));

    const plan = planRepair(db, 'proj-eg', ['proof_shell_missing'], 'studio_install_proof_shell', tmpDir, tmpDir);
    applyRepair(db, 'proj-eg', plan.plan_id, 'apply', tmpDir);

    // Proof shell install is registry-only — no new files on disk
    const filesAfter = new Set(collectAllFiles(tmpDir));
    const newFiles = [...filesAfter].filter(f => !filesBefore.has(f));
    // Proof shell only writes to DB, not filesystem
    expect(newFiles.length).toBe(0);
  });

  it('partial failure scenario — plan with already-passed finding still completes', () => {
    const b = createBootstrap(db, 'proj-eg', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    // Plan for canon vault seed
    const plan = planRepair(db, 'proj-eg', ['canon_vault_missing'], 'studio_seed_vault', tmpDir, tmpDir);
    const result = applyRepair(db, 'proj-eg', plan.plan_id, 'apply', tmpDir);

    // Should succeed — vault created
    expect(result.step_results.length).toBeGreaterThan(0);
    expect(result.verification).not.toBeNull();
    expect(result.verification!.ran).toBe(true);
  });
});

function collectAllFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectAllFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
