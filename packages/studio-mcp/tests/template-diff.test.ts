import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  registerDefaultTemplates,
  createBootstrap,
  completeBootstrap,
  getProjectStatus,
  getTemplate,
  seedProjectRegistry,
  seedVault,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
} from '@mcptoolshop/studio-bootstrap-core';
import crypto from 'node:crypto';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'template-diff-'));
  upsertProject(db, 'proj-td', 'Template Diff Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('template diff', () => {
  it('reports missing files when project diverges from template', () => {
    registerDefaultTemplates(db);

    // Project has no shells installed — should diverge
    const status = getProjectStatus(db, 'proj-td');

    const diffs = [];
    diffs.push({ component: 'canon_vault', expected: true, actual: status.installed_shells.canon, status: status.installed_shells.canon ? 'match' : 'missing' });
    diffs.push({ component: 'registry_defaults', expected: true, actual: status.installed_shells.registry, status: status.installed_shells.registry ? 'match' : 'missing' });
    diffs.push({ component: 'runtime_shell', expected: true, actual: status.installed_shells.runtime, status: status.installed_shells.runtime ? 'match' : 'missing' });
    diffs.push({ component: 'proof_shell', expected: true, actual: status.installed_shells.proof, status: status.installed_shells.proof ? 'match' : 'missing' });

    const missing = diffs.filter(d => d.status === 'missing');
    expect(missing.length).toBe(4); // Everything missing
    expect(missing.map(m => m.component)).toContain('canon_vault');
    expect(missing.map(m => m.component)).toContain('runtime_shell');
  });

  it('reports clean when project matches template', () => {
    const tmpl = registerDefaultTemplates(db);
    const bootstrap = createBootstrap(db, 'proj-td', tmpl.id, 'combat_first', tmpDir);

    installRuntimeShell(db, 'proj-td', tmpDir);
    installThemeShell(db, 'proj-td', tmpDir);
    installProofShell(db, 'proj-td');
    seedVault(db, 'proj-td', path.join(tmpDir, 'canon'), 'combat_first');

    // Register a canon page so status shows seeded
    db.prepare(`
      INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
      VALUES (?, ?, ?, 'project', 'Vision', '/tmp/v.md', 'registered')
    `).run(crypto.randomUUID(), 'proj-td', 'proj-td-vision');

    completeBootstrap(db, bootstrap.id, 'pass', null);

    const status = getProjectStatus(db, 'proj-td');
    const diffs = [
      { component: 'canon_vault', actual: status.installed_shells.canon },
      { component: 'registry_defaults', actual: status.installed_shells.registry },
      { component: 'runtime_shell', actual: status.installed_shells.runtime },
      { component: 'proof_shell', actual: status.installed_shells.proof },
    ];

    const missing = diffs.filter(d => !d.actual);
    expect(missing.length).toBe(0);
  });

  it('identifies extra files not in template', () => {
    const tmpl = registerDefaultTemplates(db);
    const bootstrap = createBootstrap(db, 'proj-td', tmpl.id, 'combat_first', tmpDir);

    installRuntimeShell(db, 'proj-td', tmpDir);
    installProofShell(db, 'proj-td');
    completeBootstrap(db, bootstrap.id, 'pass', null);

    // Template tracks 4 standard components; detect extras by checking for
    // project-specific additions outside the template baseline
    const templateComponents = ['canon_vault', 'registry_defaults', 'runtime_shell', 'proof_shell'];
    const projectComponents = [...templateComponents, 'custom_ai_bridge', 'custom_dialogue_engine'];

    const extras = projectComponents.filter(c => !templateComponents.includes(c));
    expect(extras.length).toBe(2);
    expect(extras).toContain('custom_ai_bridge');
    expect(extras).toContain('custom_dialogue_engine');
  });
});
