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
} from '@mcptoolshop/game-foundry-registry';
import {
  syncVault,
  listPages,
  linkObject,
  getLinks,
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

function makeFrontmatter(fields: Record<string, unknown>): string {
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
  return lines.join('\n');
}

/** Replicate canon_get_project_matrix logic */
function getProjectMatrix(projectId: string) {
  const pages = listPages(db, projectId);

  const byKind: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const p of pages) {
    byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
    byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  }

  const characterCount = (db.prepare('SELECT COUNT(*) as count FROM characters WHERE project_id = ?').get(projectId) as { count: number }).count;
  const charactersCovered = (db.prepare("SELECT COUNT(DISTINCT target_id) as count FROM canon_links WHERE project_id = ? AND target_type = 'character'").get(projectId) as { count: number }).count;
  const encounterCount = (db.prepare('SELECT COUNT(*) as count FROM encounters WHERE project_id = ?').get(projectId) as { count: number }).count;
  const encountersCovered = (db.prepare("SELECT COUNT(DISTINCT target_id) as count FROM canon_links WHERE project_id = ? AND target_type = 'encounter'").get(projectId) as { count: number }).count;

  let linkedCount = 0;
  for (const p of pages) {
    if (getLinks(db, p.canon_id).length > 0) linkedCount++;
  }

  const driftReports = db.prepare("SELECT result, COUNT(*) as count FROM canon_drift_reports WHERE project_id = ? GROUP BY result").all(projectId) as Array<{ result: string; count: number }>;
  const driftSummary: Record<string, number> = {};
  for (const r of driftReports) driftSummary[r.result] = r.count;

  return {
    total_pages: pages.length,
    by_kind: byKind,
    by_status: byStatus,
    linked_pages: linkedCount,
    unlinked_pages: pages.length - linkedCount,
    coverage: {
      characters: { total: characterCount, covered: charactersCovered },
      encounters: { total: encounterCount, covered: encountersCovered },
    },
    drift_summary: driftSummary,
  };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-matrix-'));
  seedProject();
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('canon project matrix', () => {
  it('returns coverage across all chapters', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertCharacter(db, { id: 'goblin', project_id: 'test', display_name: 'Goblin' });
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Enc 1', grid_rows: 3, grid_cols: 8 });

    createVaultFile('skeleton.md', makeFrontmatter({ canon_id: 'char_skeleton', kind: 'character', title: 'Skeleton' }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_skeleton', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    const matrix = getProjectMatrix('test');
    expect(matrix.coverage.characters.total).toBe(2);
    expect(matrix.coverage.characters.covered).toBe(1);
    expect(matrix.coverage.encounters.total).toBe(1);
    expect(matrix.coverage.encounters.covered).toBe(0);
  });

  it('includes linked vs unlinked page counts', () => {
    createVaultFile('char1.md', makeFrontmatter({ canon_id: 'char_a', kind: 'character', title: 'Char A' }));
    createVaultFile('char2.md', makeFrontmatter({ canon_id: 'char_b', kind: 'character', title: 'Char B' }));
    syncVault(db, 'test', tmpDir);

    upsertCharacter(db, { id: 'c1', project_id: 'test', display_name: 'C1' });
    linkObject(db, { project_id: 'test', source_canon_id: 'char_a', target_type: 'character', target_id: 'c1', link_type: 'describes' });

    const matrix = getProjectMatrix('test');
    expect(matrix.linked_pages).toBe(1);
    expect(matrix.unlinked_pages).toBe(1);
    expect(matrix.total_pages).toBe(2);
  });

  it('includes drift status per chapter', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Enc 1', grid_rows: 3, grid_cols: 8 });

    createVaultFile('ch1.md', makeFrontmatter({
      canon_id: 'chapter_ch1',
      kind: 'chapter',
      title: 'Chapter 1',
      encounter_count: 5, // drift: says 5 but only 1 exists
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'chapter_ch1', target_type: 'chapter', target_id: 'ch1', link_type: 'describes' });

    detectDrift(db, 'test', 'chapter', 'ch1');

    const matrix = getProjectMatrix('test');
    expect(matrix.drift_summary).toHaveProperty('drift');
    expect(matrix.drift_summary.drift).toBeGreaterThanOrEqual(1);
  });
});
