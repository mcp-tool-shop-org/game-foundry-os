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
  upsertEncounter,
  addEnemy,
} from '@mcptoolshop/game-foundry-registry';
import {
  syncVault,
  linkObject,
  detectDrift,
} from '@mcptoolshop/canon-core';

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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-drift-edge-'));
  seedProject();
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('drift detection edge cases', () => {
  it('chapter drift when encounter count mismatches', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Enc 1', grid_rows: 3, grid_cols: 8 });
    upsertEncounter(db, { id: 'enc2', project_id: 'test', chapter: 'ch1', label: 'Enc 2', grid_rows: 3, grid_cols: 8 });

    // Canon says 5 encounters, registry has 2
    createVaultFile('ch1.md', makeFrontmatter({
      canon_id: 'chapter_ch1',
      kind: 'chapter',
      title: 'Chapter 1',
      encounter_count: 5,
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'chapter_ch1', target_type: 'chapter', target_id: 'ch1', link_type: 'describes' });

    const result = detectDrift(db, 'test', 'chapter', 'ch1');
    expect(result.result).toBe('drift');
    expect(result.details[0].field).toBe('encounter_count');
    expect(result.details[0].canon_value).toBe(5);
    expect(result.details[0].registry_value).toBe(2);
  });

  it('drift writes canon_drift_reports row', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertVariant(db, { id: 'sk_base', character_id: 'skeleton', variant_type: 'base' });

    createVaultFile('skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
      variant_ids: ['sk_base', 'sk_phase2'], // 2 in canon, 1 in registry
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_skeleton', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    detectDrift(db, 'test', 'character', 'skeleton');

    const reports = db.prepare(
      "SELECT * FROM canon_drift_reports WHERE scope_type = 'character' AND scope_id = 'skeleton'"
    ).all() as Array<{ result: string; details_json: string }>;
    expect(reports).toHaveLength(1);
    expect(reports[0].result).toBe('drift');
    const details = JSON.parse(reports[0].details_json);
    expect(details[0].field).toBe('variant_count');
  });

  it('clean result when canon matches production', () => {
    upsertCharacter(db, { id: 'goblin', project_id: 'test', display_name: 'Goblin' });
    upsertVariant(db, { id: 'g_base', character_id: 'goblin', variant_type: 'base' });
    upsertVariant(db, { id: 'g_phase2', character_id: 'goblin', variant_type: 'phase2' });

    createVaultFile('goblin.md', makeFrontmatter({
      canon_id: 'char_goblin',
      kind: 'character',
      title: 'Goblin',
      variant_ids: ['g_base', 'g_phase2'], // 2 matches 2
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_goblin', target_type: 'character', target_id: 'goblin', link_type: 'describes' });

    const result = detectDrift(db, 'test', 'character', 'goblin');
    expect(result.result).toBe('clean');
    expect(result.details).toHaveLength(0);
  });

  it('warning result for non-critical mismatch', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Enc 1', grid_rows: 3, grid_cols: 8 });
    // Add one enemy
    addEnemy(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'g_base', sprite_pack: 'goblin', grid_row: 0, grid_col: 0, sort_order: 0 });

    // Canon says unit_count=3, registry has 1 — this is severity=warning
    createVaultFile('enc.md', makeFrontmatter({
      canon_id: 'enc_forest',
      kind: 'encounter',
      title: 'Forest Encounter',
      unit_count: 3,
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'enc_forest', target_type: 'encounter', target_id: 'enc1', link_type: 'describes' });

    const result = detectDrift(db, 'test', 'encounter', 'enc1');
    expect(result.result).toBe('warning');
    expect(result.details[0].field).toBe('unit_count');
    expect(result.details[0].severity).toBe('warning');
  });

  it('handles missing canon page gracefully', () => {
    upsertCharacter(db, { id: 'orphan', project_id: 'test', display_name: 'Orphan' });
    // No canon page linked to this character
    const result = detectDrift(db, 'test', 'character', 'orphan');
    expect(result.result).toBe('clean');
    expect(result.details).toHaveLength(0);
  });
});
