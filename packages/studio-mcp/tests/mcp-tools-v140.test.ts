import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  getAdoptionStage,
  generateAdoptionPlan,
  classifyProject,
  computeQualityStates,
  getWeakestDomain,
  persistQualityStates,
  ALL_DOMAINS,
  approveRepairPlan,
  planRepair,
  createBootstrap,
  completeBootstrap,
  runDiagnostics,
} from '@mcptoolshop/studio-bootstrap-core';
import type { BootstrapDiagnosticResult } from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tools-v140-'));
  upsertProject(db, 'proj-mcp4', 'MCP Tools v140', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('MCP tool wrappers v1.4.0', () => {
  it('studio_get_adoption_plan returns plan or error', () => {
    // No plan exists → getAdoptionStage returns null
    const noResult = getAdoptionStage(db, 'proj-mcp4');
    expect(noResult).toBeNull();

    // Generate a plan
    const diag = runDiagnostics(db, 'proj-mcp4', tmpDir);
    const scan = { 'project.godot': false, 'canon_vault': false };
    const diagResult: BootstrapDiagnosticResult = {
      project_id: 'proj-mcp4',
      pass: false,
      findings: diag.findings,
      blocker_count: diag.blocker_count,
      warning_count: diag.warning_count,
      repair_candidates: diag.repair_candidates,
      next_action: diag.next_action,
    };
    const profile = classifyProject(scan, diagResult);
    generateAdoptionPlan(db, 'proj-mcp4', profile, diag.findings);

    // Now plan exists → getAdoptionStage returns stage info
    const result = getAdoptionStage(db, 'proj-mcp4');
    expect(result).not.toBeNull();
    expect(result!.stage).toBeDefined();
    expect(result!.stage.name).toBeTruthy();
    expect(Array.isArray(result!.next_actions)).toBe(true);
    expect(result!.next_actions.length).toBeGreaterThan(0);
  });

  it('studio_get_quality_state returns per-domain scores', () => {
    // Compute + persist (mimics what the MCP tool does)
    const states = computeQualityStates(db, 'proj-mcp4', tmpDir);
    persistQualityStates(db, 'proj-mcp4', states);
    const weakest = getWeakestDomain(states);

    // Verify shape matches what MCP tool returns
    expect(states).toHaveLength(ALL_DOMAINS.length);
    for (const state of states) {
      expect(ALL_DOMAINS).toContain(state.domain);
      expect(['healthy', 'warning', 'degraded', 'blocked', 'unknown']).toContain(state.status);
    }

    // Overall: not all healthy → weakest should exist
    const allHealthy = states.every(s => s.status === 'healthy');
    if (!allHealthy) {
      expect(weakest).not.toBeNull();
    }

    // Verify persisted rows match
    const rows = db.prepare('SELECT * FROM quality_domain_states WHERE project_id = ?').all('proj-mcp4') as any[];
    expect(rows.length).toBe(ALL_DOMAINS.length);
  });

  it('studio_approve_repair approves and returns result', () => {
    fs.writeFileSync(path.join(tmpDir, 'project.godot'), '; test\n[application]\nconfig/name="Test"\n', 'utf-8');

    // Plan moderate repair
    const plan = planRepair(db, 'proj-mcp4', ['autoload_missing'], 'godot_register_autoload', tmpDir, tmpDir);

    // Approve (mimics MCP tool)
    const result = approveRepairPlan(db, plan.plan_id, 'mike');
    expect(result.plan_id).toBe(plan.plan_id);
    expect(result.approval_status).toBe('approved');

    // Verify in DB
    const row = db.prepare('SELECT approval_status, approved_by FROM repair_plans WHERE id = ?').get(plan.plan_id) as any;
    expect(row.approval_status).toBe('approved');
    expect(row.approved_by).toBe('mike');
  });
});
