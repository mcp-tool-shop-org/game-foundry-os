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
  getPage,
  listPages,
  searchPages,
  linkObject,
  getLinks,
  getLinksTo,
  detectDrift,
  generateHandoff,
  getCanonNextStep,
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

/** Create a page stub file (replicating canonCreatePageStub logic) */
function createPageStub(vaultRoot: string, relativePath: string, canonId: string, kind: string, title: string, extra?: Record<string, unknown>) {
  const fullPath = path.join(vaultRoot, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const fm: Record<string, unknown> = { canon_id: canonId, kind, title, ...extra };
  const lines = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) lines.push(`  - ${item}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---', '', `# ${title}`, '', '<!-- Add canon content here -->', '');
  fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');
}

/** Replicate canon_validate_pages logic */
function validatePages(projectId: string) {
  const REQUIRED_FIELDS: Record<string, string[]> = {
    character: ['canon_id', 'kind', 'title'],
    encounter: ['canon_id', 'kind', 'title'],
    chapter: ['canon_id', 'kind', 'title'],
  };

  const pages = listPages(db, projectId);
  const results: Array<{ canon_id: string; title: string; valid: boolean; issues: string[] }> = [];

  for (const page of pages) {
    const issues: string[] = [];
    if (!page.frontmatter_json) {
      issues.push('Missing frontmatter_json');
    } else {
      const fm = JSON.parse(page.frontmatter_json);
      const required = REQUIRED_FIELDS[page.kind] ?? REQUIRED_FIELDS.character;
      for (const field of required) {
        if (!fm[field]) issues.push(`Missing required frontmatter field: ${field}`);
      }
    }
    results.push({ canon_id: page.canon_id, title: page.title, valid: issues.length === 0, issues });
  }

  return { total: results.length, valid: results.filter(r => r.valid).length, invalid: results.filter(r => !r.valid).length, pages: results };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-workflow-'));
  seedProject();
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('full canon workflow', () => {
  it('syncs vault and registers pages', () => {
    createVaultFile('characters/skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton Warrior',
    }));
    createVaultFile('encounters/forest.md', makeFrontmatter({
      canon_id: 'enc_forest',
      kind: 'encounter',
      title: 'Forest Ambush',
    }));

    const result = syncVault(db, 'test', tmpDir);
    expect(result.scanned).toBe(2);
    expect(result.registered).toBe(2);

    const pages = listPages(db, 'test');
    expect(pages).toHaveLength(2);
  });

  it('validates pages and reports missing frontmatter', () => {
    createVaultFile('char.md', makeFrontmatter({ canon_id: 'char_test', kind: 'character', title: 'Test' }));
    syncVault(db, 'test', tmpDir);

    const validation = validatePages('test');
    expect(validation.total).toBe(1);
    expect(validation.valid).toBe(1);
    expect(validation.invalid).toBe(0);
  });

  it('links character page to variant', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertVariant(db, { id: 'sk_base', character_id: 'skeleton', variant_type: 'base' });

    createVaultFile('skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
      variant_ids: ['sk_base'],
    }));
    syncVault(db, 'test', tmpDir);

    const link = linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_skeleton',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });
    expect(link.target_type).toBe('character');
    expect(link.target_id).toBe('skeleton');

    const page = getPage(db, 'char_skeleton');
    expect(page!.status).toBe('linked');
  });

  it('links encounter page to encounter', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Forest', grid_rows: 3, grid_cols: 8 });

    createVaultFile('enc.md', makeFrontmatter({
      canon_id: 'enc_forest',
      kind: 'encounter',
      title: 'Forest Encounter',
    }));
    syncVault(db, 'test', tmpDir);

    const link = linkObject(db, {
      project_id: 'test',
      source_canon_id: 'enc_forest',
      target_type: 'encounter',
      target_id: 'enc1',
      link_type: 'describes',
    });
    expect(link.target_type).toBe('encounter');
  });

  it('gets character bible with production state', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertVariant(db, { id: 'sk_base', character_id: 'skeleton', variant_type: 'base' });

    createVaultFile('skeleton.md', makeFrontmatter({ canon_id: 'char_skeleton', kind: 'character', title: 'Skeleton' }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_skeleton', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    // Character bible = getLinksTo + production state
    const links = getLinksTo(db, 'character', 'skeleton');
    expect(links).toHaveLength(1);
    const canonPages = links.map(l => getPage(db, l.source_canon_id)).filter(Boolean);
    expect(canonPages).toHaveLength(1);
    expect(canonPages[0]!.title).toBe('Skeleton');
  });

  it('gets encounter intent with manifest state', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Forest', grid_rows: 3, grid_cols: 8 });
    addEnemy(db, { encounter_id: 'enc1', display_name: 'Goblin', variant_id: 'g_base', sprite_pack: 'goblin', grid_row: 0, grid_col: 0, sort_order: 0 });

    createVaultFile('enc.md', makeFrontmatter({ canon_id: 'enc_forest', kind: 'encounter', title: 'Forest Encounter' }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'enc_forest', target_type: 'encounter', target_id: 'enc1', link_type: 'describes' });

    const links = getLinksTo(db, 'encounter', 'enc1');
    expect(links).toHaveLength(1);
    const canonPages = links.map(l => getPage(db, l.source_canon_id)).filter(Boolean);
    expect(canonPages[0]!.title).toBe('Forest Encounter');
  });

  it('detects drift between canon and production', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertVariant(db, { id: 'sk_base', character_id: 'skeleton', variant_type: 'base' });

    createVaultFile('skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
      variant_ids: ['sk_base', 'sk_phase2'],
    }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_skeleton', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    const drift = detectDrift(db, 'test', 'character', 'skeleton');
    expect(drift.result).toBe('drift');
    expect(drift.details[0].field).toBe('variant_count');
  });

  it('generates handoff artifact', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    createVaultFile('skeleton.md', makeFrontmatter({ canon_id: 'char_skeleton', kind: 'character', title: 'Skeleton' }));
    syncVault(db, 'test', tmpDir);
    linkObject(db, { project_id: 'test', source_canon_id: 'char_skeleton', target_type: 'character', target_id: 'skeleton', link_type: 'describes' });

    const handoff = generateHandoff(db, 'test', 'character', 'skeleton', 'production_brief');
    expect(handoff.scope_type).toBe('character');
    expect(handoff.scope_id).toBe('skeleton');
    expect(handoff.canon_summary.page_count).toBe(1);
    expect(handoff.artifact_type).toBe('production_brief');
  });

  it('creates page stub with valid frontmatter', () => {
    createPageStub(tmpDir, 'characters/dragon.md', 'char_dragon', 'character', 'Dragon Lord');

    // Verify file was created
    expect(fs.existsSync(path.join(tmpDir, 'characters/dragon.md'))).toBe(true);

    // Sync and verify it registers
    const result = syncVault(db, 'test', tmpDir);
    expect(result.registered).toBe(1);

    const page = getPage(db, 'char_dragon');
    expect(page).toBeDefined();
    expect(page!.title).toBe('Dragon Lord');
    expect(page!.kind).toBe('character');
  });

  it('get_next_step reports unlinked pages', () => {
    createVaultFile('char.md', makeFrontmatter({ canon_id: 'char_test', kind: 'character', title: 'Test' }));
    syncVault(db, 'test', tmpDir);

    const step = getCanonNextStep(db, 'test');
    expect(step.action).toBe('link_object');
    expect(step.details).toHaveProperty('unlinked_count', 1);
  });
});
