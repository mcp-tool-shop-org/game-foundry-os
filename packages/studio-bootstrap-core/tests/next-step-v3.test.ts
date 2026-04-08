import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
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

function seedProject(id = 'proj-ns3') {
  upsertProject(db, id, 'NextStep V3 Project', tmpDir);
}

function seedBootstrap(id = 'proj-ns3') {
  const b = createBootstrap(db, id, null, 'combat_first', tmpDir);
  completeBootstrap(db, b.id, 'pass');
}

function makeReady(id = 'proj-ns3') {
  seedProject(id);
  seedBootstrap(id);
  installRuntimeShell(db, id, tmpDir);
  installThemeShell(db, id, tmpDir);
  installProofShell(db, id);
  seedProjectRegistry(db, id, 'godot-tactics-template');
  seedVault(db, id, path.join(tmpDir, 'canon'), 'combat_first');
  db.prepare(`INSERT INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status) VALUES ('cp-ns3', ?, 'ns3-vision', 'project', 'Vision', '/tmp/v.md', 'registered')`).run(id);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'next-step-v3-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('next-step V3', () => {
  it('returns StudioNextStepV3 shape with quality_domain and why_it_matters', () => {
    seedProject();
    seedBootstrap();
    const next = getStudioNextStep(db, 'proj-ns3');
    expect(next).toHaveProperty('quality_domain');
    expect(next).toHaveProperty('why_it_matters');
    expect(typeof next.why_it_matters).toBe('string');
    expect(next.why_it_matters.length).toBeGreaterThan(0);
  });

  it('quality_domain is set for finding-based actions', () => {
    seedProject();
    seedBootstrap();
    const next = getStudioNextStep(db, 'proj-ns3');
    expect(next.quality_domain).toBeTruthy();
  });

  it('quality_domain is null for non-finding actions like create_project', () => {
    const next = getStudioNextStep(db, 'nonexistent');
    expect(next.action).toBe('create_project');
    expect(next.quality_domain).toBeNull();
  });

  it('why_it_matters contains game-oriented language', () => {
    seedProject();
    seedBootstrap();
    const next = getStudioNextStep(db, 'proj-ns3');
    // Should not contain generic tech jargon like "configuration"
    expect(next.why_it_matters).toMatch(/game|playable|launch|render|combat|proof/i);
  });

  it('playability domain outranks runtime when both have critical findings', () => {
    seedProject();
    seedBootstrap();
    // Both proof_shell_missing (playability) and shell_* (runtime) are critical
    const next = getStudioNextStep(db, 'proj-ns3');
    // Playability (weight 0) should win over runtime (weight 1)
    expect(next.quality_domain).toBe('playability_integrity');
  });

  it('config-compliant but not slice-provable points at proof', () => {
    makeReady();
    // Add a character and encounter so it doesn't suggest create_character
    db.prepare("INSERT INTO characters (id, project_id, display_name) VALUES ('c1', 'proj-ns3', 'Test')").run();
    db.prepare("INSERT INTO encounters (id, project_id, chapter, label) VALUES ('e1', 'proj-ns3', 'ch1', 'Test')").run();
    // No proof runs exist
    const next = getStudioNextStep(db, 'proj-ns3');
    expect(next.action).toBe('run_proof_suite');
    expect(next.quality_domain).toBe('playability_integrity');
    expect(next.why_it_matters).toContain('playable');
  });

  it('backward compatible: V3 extends V2 fields', () => {
    seedProject();
    seedBootstrap();
    const next = getStudioNextStep(db, 'proj-ns3');
    // All V2 fields still present
    expect(next).toHaveProperty('action');
    expect(next).toHaveProperty('action_key');
    expect(next).toHaveProperty('target');
    expect(next).toHaveProperty('reason');
    expect(next).toHaveProperty('priority');
    expect(next).toHaveProperty('source');
    expect(next).toHaveProperty('can_dry_run');
    expect(next).toHaveProperty('can_apply');
    expect(next).toHaveProperty('expected_outcome');
  });

  it('continue_production has null quality_domain', () => {
    makeReady();
    db.prepare("INSERT INTO characters (id, project_id, display_name) VALUES ('c1', 'proj-ns3', 'Test')").run();
    db.prepare("INSERT INTO encounters (id, project_id, chapter, label) VALUES ('e1', 'proj-ns3', 'ch1', 'Test')").run();
    // Add a proof run so it doesn't suggest run_proof_suite
    db.prepare("INSERT INTO proof_runs (id, project_id, scope_type, scope_id, result, blocking_failures, warning_count) VALUES ('pr1', 'proj-ns3', 'variant', 'v1', 'pass', 0, 0)").run();
    const next = getStudioNextStep(db, 'proj-ns3');
    expect(next.action).toBe('continue_production');
    expect(next.quality_domain).toBeNull();
  });

  it('different domains produce different why_it_matters text', () => {
    // Collect why_it_matters for different domain scenarios
    const texts = new Set<string>();

    // playability domain
    seedProject('proj-play');
    seedBootstrap('proj-play');
    texts.add(getStudioNextStep(db, 'proj-play').why_it_matters);

    // After installing proof shell, runtime domain should be next
    installProofShell(db, 'proj-play');
    const next2 = getStudioNextStep(db, 'proj-play');
    texts.add(next2.why_it_matters);

    expect(texts.size).toBeGreaterThanOrEqual(2);
  });
});
