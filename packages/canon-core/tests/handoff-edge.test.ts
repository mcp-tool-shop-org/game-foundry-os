import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
} from '@mcptoolshop/game-foundry-registry';
import {
  syncVault,
  linkObject,
  detectDrift,
  generateHandoff,
} from '@mcptoolshop/canon-core';
import { createProofRun, createFreezeCandidate, promoteFreeze, runAssetSuite } from '@mcptoolshop/proof-lab-core';

let db: Database.Database;
let tmpDir: string;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function createVaultFile(relativePath: string, content: string) {
  const fullPath = path.join(tmpDir, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

function makeFrontmatter(fields: Record<string, unknown>, body = ''): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---');
  if (body) lines.push('', body);
  return lines.join('\n');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-handoff-edge-'));
  seedProject();
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('handoff edge cases', () => {
  it('handoff includes canon page content summary', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    createVaultFile('skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton Warrior',
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_skeleton', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    const handoff = generateHandoff(db, 'test', 'character', 'skeleton', 'production_brief');
    expect(handoff.canon_summary.page_count).toBe(1);
    expect(handoff.canon_summary.pages[0].canon_id).toBe('char_skeleton');
    expect(handoff.canon_summary.pages[0].title).toBe('Skeleton Warrior');
    expect(handoff.canon_summary.pages[0].kind).toBe('character');
  });

  it('handoff includes production state for linked objects', () => {
    upsertCharacter(db, { id: 'goblin', project_id: 'test', display_name: 'Goblin' });
    createVaultFile('goblin.md', makeFrontmatter({
      canon_id: 'char_goblin',
      kind: 'character',
      title: 'Goblin',
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_goblin', target_type: 'character', target_id: 'goblin', link_type: 'describes' });

    const handoff = generateHandoff(db, 'test', 'character', 'goblin', 'production_brief');
    expect(handoff.production_summary).toHaveProperty('concept_status');
    expect(handoff.production_summary).toHaveProperty('directional_status');
  });

  it('handoff includes proof/freeze status when available', () => {
    upsertCharacter(db, { id: 'hero', project_id: 'test', display_name: 'Hero' });
    upsertVariant(db, { id: 'hero_v', character_id: 'hero', variant_type: 'base' });
    db.prepare("UPDATE variants SET pack_present = 1, directions_present = 8, production_state = 'pack_sliced' WHERE id = 'hero_v'").run();

    // Run proof suite and freeze
    runAssetSuite(db, 'test', 'variant', 'hero_v');
    const candidate = createFreezeCandidate(db, 'test', 'variant', 'hero_v');
    promoteFreeze(db, 'test', candidate.id);

    // Now generate handoff for the variant scope
    const handoff = generateHandoff(db, 'test', 'variant', 'hero_v', 'freeze_packet');
    expect(handoff.proof_summary).toHaveProperty('total_runs');
    expect(handoff.freeze_summary).toHaveProperty('frozen');
    expect(handoff.freeze_summary.frozen).toBe(true);
  });

  it('missing linked data is reported as debt in handoff', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertVariant(db, { id: 'sk_base', character_id: 'skeleton', variant_type: 'base' });

    // Create page with mismatched variant_ids to trigger drift
    createVaultFile('skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
      variant_ids: ['sk_base', 'sk_phase2'], // 2 in canon, 1 in registry
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_skeleton', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    // Detect drift (writes canon_drift_reports)
    detectDrift(db, 'test', 'character', 'skeleton');

    const handoff = generateHandoff(db, 'test', 'character', 'skeleton', 'production_brief');
    expect(handoff.open_debt.length).toBeGreaterThan(0);
    expect(handoff.open_debt[0]).toContain('variant_count');
  });
});
