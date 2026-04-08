import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  getProjectStatus,
  runDiagnostics,
  getStudioNextStep,
  createBootstrap,
  completeBootstrap,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  seedProjectRegistry,
  seedVault,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-mcp') {
  upsertProject(db, id, 'MCP Orch Project', tmpDir);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-mcp-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('studio MCP orchestration tools', () => {
  it('studio_project_status returns engine_truth section', () => {
    seedProject();
    installRuntimeShell(db, 'proj-mcp', tmpDir);
    const b = createBootstrap(db, 'proj-mcp', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const result = getProjectStatus(db, 'proj-mcp');
    expect(result.engine_truth).toBeDefined();
    expect(typeof result.engine_truth.project_config_valid).toBe('boolean');
    expect(typeof result.engine_truth.shell_compliance).toBe('boolean');
    expect(typeof result.engine_truth.display_width).toBe('number');
    expect(typeof result.engine_truth.stretch_mode).toBe('string');
    expect(typeof result.engine_truth.renderer).toBe('string');
  });

  it('studio_bootstrap_diagnostics returns findings array', () => {
    seedProject();
    const result = runDiagnostics(db, 'proj-mcp', tmpDir);
    expect(Array.isArray(result.findings)).toBe(true);
    expect(typeof result.blocker_count).toBe('number');
    expect(typeof result.warning_count).toBe('number');
    expect(typeof result.pass).toBe('boolean');
    expect(typeof result.next_action).toBe('string');
  });

  it('studio_get_next_step returns action + source', () => {
    seedProject();
    const b = createBootstrap(db, 'proj-mcp', null, 'combat_first', tmpDir);
    completeBootstrap(db, b.id, 'pass');

    const result = getStudioNextStep(db, 'proj-mcp');
    expect(result.action).toBeTruthy();
    expect(result.reason).toBeTruthy();
    expect(['critical', 'normal', 'low']).toContain(result.priority);
    // source is string|null
    expect(result.source === null || typeof result.source === 'string').toBe(true);
  });

  it('studio_import_existing_project returns classified report', () => {
    seedProject();
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ImportTest"\n',
      'utf-8',
    );

    const b = createBootstrap(db, 'proj-mcp', null, 'import_existing', tmpDir);
    const diag = runDiagnostics(db, 'proj-mcp', tmpDir);
    const foundCount = diag.findings.length;

    completeBootstrap(db, b.id, foundCount === 0 ? 'pass' : 'partial');

    expect(diag.findings.length).toBeGreaterThan(0);
    expect(diag.repair_candidates.length).toBeGreaterThan(0);
  });

  it('studio_project_status handles nonexistent project', () => {
    // Project not registered — should still return without crashing
    const result = getProjectStatus(db, 'nonexistent');
    expect(result.project_id).toBe('nonexistent');
    expect(result.status).toBe('incomplete');
    expect(result.bootstrap_result).toBeNull();
  });

  it('studio_bootstrap_diagnostics handles project with no project.godot', () => {
    seedProject();
    const result = runDiagnostics(db, 'proj-mcp', tmpDir);
    expect(result.pass).toBe(false);
    const godotFinding = result.findings.find(f => f.id === 'engine_project_godot');
    expect(godotFinding).toBeDefined();
    expect(godotFinding!.severity).toBe('critical');
  });
});
