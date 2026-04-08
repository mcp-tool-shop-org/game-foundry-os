import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { runDiagnostics, installRuntimeShell } from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-trace-'));
  upsertProject(db, 'proj-dt', 'Diag Trace Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('diagnostic source tracing', () => {
  it('missing shell file finding has source_tool=template_shell_verify', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="TraceTest"\n',
      'utf-8',
    );
    const result = runDiagnostics(db, 'proj-dt', tmpDir);
    const shellFinding = result.findings.find(f => f.id.startsWith('shell_'));
    expect(shellFinding).toBeDefined();
    expect(shellFinding!.source_tool).toBe('template_shell_verify');
  });

  it('missing autoload finding has source_tool=autoload_contract', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="TraceTest"\n\n[autoload]\nCustom="*res://custom.gd"\n',
      'utf-8',
    );
    fs.writeFileSync(path.join(tmpDir, 'custom.gd'), '# stub', 'utf-8');

    const result = runDiagnostics(db, 'proj-dt', tmpDir);
    const autoloadFinding = result.findings.find(f => f.id.startsWith('autoload_missing_'));
    expect(autoloadFinding).toBeDefined();
    expect(autoloadFinding!.source_tool).toBe('autoload_contract');
  });

  it('import violation finding has source_tool=asset_import_audit', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'project.godot'),
      '[application]\nconfig/name="ImportAudit"\n',
      'utf-8',
    );
    // Create a bad import file
    const importDir = path.join(tmpDir, 'assets', 'sprites');
    fs.mkdirSync(importDir, { recursive: true });
    fs.writeFileSync(
      path.join(importDir, 'bad.png.import'),
      '[remap]\nimporter="texture"\n\n[params]\ncompress/mode=2\nmipmaps/generate=true\n',
      'utf-8',
    );

    const result = runDiagnostics(db, 'proj-dt', tmpDir);
    const importFinding = result.findings.find(f => f.source_tool === 'asset_import_audit');
    expect(importFinding).toBeDefined();
  });

  it('missing canon vault finding has source_tool=canon_sync_vault', () => {
    const result = runDiagnostics(db, 'proj-dt', tmpDir);
    const vaultFinding = result.findings.find(f => f.id === 'canon_vault_missing');
    expect(vaultFinding).toBeDefined();
    expect(vaultFinding!.source_tool).toBe('canon_sync_vault');
  });

  it('findings have unique IDs', () => {
    const result = runDiagnostics(db, 'proj-dt', tmpDir);
    const ids = result.findings.map(f => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('repairable findings have non-null repair_action', () => {
    const result = runDiagnostics(db, 'proj-dt', tmpDir);
    const repairable = result.findings.filter(f => f.repairable);
    expect(repairable.length).toBeGreaterThan(0);
    for (const f of repairable) {
      expect(f.repair_action).not.toBeNull();
      expect(f.repair_action).toBeTruthy();
    }
  });
});
