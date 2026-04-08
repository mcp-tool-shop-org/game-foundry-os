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
  parseMarkdownFrontmatter,
  syncVault,
  getPage,
  getPageById,
  listPages,
  updatePageStatus,
  searchPages,
  linkObject,
  getLinks,
  getLinksTo,
  unlinkObject,
  createSnapshot,
  getSnapshots,
  compareSnapshots,
  detectDrift,
  generateHandoff,
  getCanonTimeline,
  getCanonNextStep,
} from '@mcptoolshop/canon-core';

let db: Database.Database;
let tmpDir: string;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function createVaultFile(vaultRoot: string, relativePath: string, content: string) {
  const fullPath = path.join(vaultRoot, relativePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content, 'utf-8');
}

function makeFrontmatter(fields: Record<string, unknown>, body = ''): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'canon-test-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Frontmatter Parsing ──────────────────────────────────

describe('frontmatter parsing', () => {
  it('parses valid YAML frontmatter', () => {
    const content = makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton Warrior',
    }, 'Some body text');

    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.canon_id).toBe('char_skeleton');
    expect(result!.frontmatter.kind).toBe('character');
    expect(result!.frontmatter.title).toBe('Skeleton Warrior');
    expect(result!.body).toBe('Some body text');
  });

  it('returns null for file without frontmatter', () => {
    const result = parseMarkdownFrontmatter('# Just a heading\n\nSome text.');
    expect(result).toBeNull();
  });

  it('handles arrays in frontmatter', () => {
    const content = makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
      variant_ids: ['base', 'phase2', 'alt'],
    });

    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.variant_ids).toEqual(['base', 'phase2', 'alt']);
  });

  it('handles empty frontmatter block', () => {
    const content = '---\n---\nBody here';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter).toEqual({});
    expect(result!.body).toBe('Body here');
  });

  it('handles inline arrays', () => {
    const content = '---\ncanon_id: test\nkind: character\ntitle: Test\ntags: [combat, melee]\n---\n';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.tags).toEqual(['combat', 'melee']);
  });

  it('handles boolean and number values', () => {
    const content = '---\ncanon_id: test\nkind: character\ntitle: Test\nactive: true\ncount: 42\n---\n';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.active).toBe(true);
    expect(result!.frontmatter.count).toBe(42);
  });

  it('handles quoted strings', () => {
    const content = '---\ncanon_id: "char:test"\nkind: character\ntitle: "A Title: With Colon"\n---\n';
    const result = parseMarkdownFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.canon_id).toBe('char:test');
    expect(result!.frontmatter.title).toBe('A Title: With Colon');
  });
});

// ─── Vault Sync ───────────────────────────────────────────

describe('vault sync', () => {
  it('registers new pages from vault', () => {
    seedProject();
    createVaultFile(tmpDir, 'characters/skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton Warrior',
    }));

    const result = syncVault(db, 'test', tmpDir);
    expect(result.scanned).toBe(1);
    expect(result.registered).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.invalid).toHaveLength(0);

    const page = getPage(db, 'char_skeleton');
    expect(page).toBeDefined();
    expect(page!.title).toBe('Skeleton Warrior');
  });

  it('updates existing pages when content changes', () => {
    seedProject();
    createVaultFile(tmpDir, 'characters/skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton Warrior',
    }));

    syncVault(db, 'test', tmpDir);

    // Update file
    createVaultFile(tmpDir, 'characters/skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton Warrior (Updated)',
    }));

    const result = syncVault(db, 'test', tmpDir);
    expect(result.updated).toBe(1);
    expect(result.registered).toBe(0);

    const page = getPage(db, 'char_skeleton');
    expect(page!.title).toBe('Skeleton Warrior (Updated)');
  });

  it('reports invalid pages with missing frontmatter', () => {
    seedProject();
    createVaultFile(tmpDir, 'notes/random.md', '# Just a note\nNo frontmatter here.');

    const result = syncVault(db, 'test', tmpDir);
    expect(result.scanned).toBe(1);
    expect(result.registered).toBe(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain('No frontmatter');
  });

  it('handles nested vault directories', () => {
    seedProject();
    createVaultFile(tmpDir, 'game/ch1/characters/goblin.md', makeFrontmatter({
      canon_id: 'char_goblin',
      kind: 'character',
      title: 'Goblin',
    }));
    createVaultFile(tmpDir, 'game/ch1/encounters/forest.md', makeFrontmatter({
      canon_id: 'enc_forest',
      kind: 'encounter',
      title: 'Forest Ambush',
    }));

    const result = syncVault(db, 'test', tmpDir);
    expect(result.scanned).toBe(2);
    expect(result.registered).toBe(2);
  });

  it('reports pages missing required frontmatter fields', () => {
    seedProject();
    createVaultFile(tmpDir, 'missing.md', '---\ncanon_id: test\n---\nBody');

    const result = syncVault(db, 'test', tmpDir);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].reason).toContain('kind');
    expect(result.invalid[0].reason).toContain('title');
  });
});

// ─── Pages ────────────────────────────────────────────────

describe('pages', () => {
  beforeEach(() => {
    seedProject();
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test Character',
    }));
    createVaultFile(tmpDir, 'enc.md', makeFrontmatter({
      canon_id: 'enc_test',
      kind: 'encounter',
      title: 'Test Encounter',
    }));
    syncVault(db, 'test', tmpDir);
  });

  it('gets page by canon_id', () => {
    const page = getPage(db, 'char_test');
    expect(page).toBeDefined();
    expect(page!.title).toBe('Test Character');
    expect(page!.kind).toBe('character');
  });

  it('gets page by internal id', () => {
    const page = getPage(db, 'char_test');
    const pageById = getPageById(db, page!.id);
    expect(pageById).toBeDefined();
    expect(pageById!.canon_id).toBe('char_test');
  });

  it('lists pages filtered by kind', () => {
    const chars = listPages(db, 'test', { kind: 'character' });
    expect(chars).toHaveLength(1);
    expect(chars[0].kind).toBe('character');

    const encs = listPages(db, 'test', { kind: 'encounter' });
    expect(encs).toHaveLength(1);
  });

  it('searches pages by title text', () => {
    const results = searchPages(db, 'test', 'Character');
    expect(results).toHaveLength(1);
    expect(results[0].canon_id).toBe('char_test');
  });

  it('updates page status', () => {
    updatePageStatus(db, 'char_test', 'canonical');
    const page = getPage(db, 'char_test');
    expect(page!.status).toBe('canonical');
  });
});

// ─── Links ────────────────────────────────────────────────

describe('links', () => {
  beforeEach(() => {
    seedProject();
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_page',
      kind: 'character',
      title: 'Skeleton Page',
    }));
    syncVault(db, 'test', tmpDir);
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
  });

  it('links canon page to character', () => {
    const link = linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_page',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });

    expect(link.source_canon_id).toBe('char_page');
    expect(link.target_type).toBe('character');
    expect(link.target_id).toBe('skeleton');

    // Page status should be updated to 'linked'
    const page = getPage(db, 'char_page');
    expect(page!.status).toBe('linked');
  });

  it('links canon page to encounter', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Encounter 1', grid_rows: 3, grid_cols: 8 });
    createVaultFile(tmpDir, 'enc.md', makeFrontmatter({
      canon_id: 'enc_page',
      kind: 'encounter',
      title: 'Encounter Page',
    }));
    syncVault(db, 'test', tmpDir);

    const link = linkObject(db, {
      project_id: 'test',
      source_canon_id: 'enc_page',
      target_type: 'encounter',
      target_id: 'enc1',
      link_type: 'describes',
    });
    expect(link.target_type).toBe('encounter');
  });

  it('getLinks returns links from a page', () => {
    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_page',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });

    const links = getLinks(db, 'char_page');
    expect(links).toHaveLength(1);
    expect(links[0].target_id).toBe('skeleton');
  });

  it('getLinksTo returns links to a target', () => {
    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_page',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });

    const links = getLinksTo(db, 'character', 'skeleton');
    expect(links).toHaveLength(1);
    expect(links[0].source_canon_id).toBe('char_page');
  });

  it('unlinkObject removes a link', () => {
    const link = linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_page',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });

    unlinkObject(db, link.id);
    const links = getLinks(db, 'char_page');
    expect(links).toHaveLength(0);
  });
});

// ─── Snapshots ────────────────────────────────────────────

describe('snapshots', () => {
  beforeEach(() => {
    seedProject();
  });

  it('creates snapshot with content hash', () => {
    const snap = createSnapshot(db, 'test', 'char_test', 'abc123', { title: 'Test', body: 'Hello' });
    expect(snap.content_hash).toBe('abc123');
    expect(snap.canon_id).toBe('char_test');
  });

  it('lists snapshots for a page', () => {
    createSnapshot(db, 'test', 'char_test', 'hash1', { v: 1 });
    createSnapshot(db, 'test', 'char_test', 'hash2', { v: 2 });

    const snaps = getSnapshots(db, 'char_test');
    expect(snaps).toHaveLength(2);
  });

  it('compares two snapshots', () => {
    const s1 = createSnapshot(db, 'test', 'char_test', 'hash1', { title: 'V1', role: 'enemy' });
    const s2 = createSnapshot(db, 'test', 'char_test', 'hash2', { title: 'V2', faction: 'undead' });

    const diff = compareSnapshots(db, s1.id, s2.id);
    expect(diff).not.toBeNull();
    expect(diff!.hashes_match).toBe(false);
    expect(diff!.frontmatter_diff.added_keys).toContain('faction');
    expect(diff!.frontmatter_diff.removed_keys).toContain('role');
    expect(diff!.frontmatter_diff.changed_keys).toContain('title');
  });

  it('returns null for non-existent snapshots', () => {
    const diff = compareSnapshots(db, 'nonexistent1', 'nonexistent2');
    expect(diff).toBeNull();
  });
});

// ─── Drift Detection ─────────────────────────────────────

describe('drift detection', () => {
  beforeEach(() => {
    seedProject();
  });

  it('reports clean when canon matches registry', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertVariant(db, { id: 'skeleton_base', character_id: 'skeleton', variant_type: 'base' });

    // Create canon page with matching variant_ids
    createVaultFile(tmpDir, 'skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
      variant_ids: ['skeleton_base'],
    }));
    syncVault(db, 'test', tmpDir);

    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_skeleton',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });

    const result = detectDrift(db, 'test', 'character', 'skeleton');
    expect(result.result).toBe('clean');
    expect(result.details).toHaveLength(0);
  });

  it('reports drift when variant count mismatches', () => {
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
    upsertVariant(db, { id: 'skeleton_base', character_id: 'skeleton', variant_type: 'base' });

    // Canon says 2 variants, registry has 1
    createVaultFile(tmpDir, 'skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
      variant_ids: ['skeleton_base', 'skeleton_phase2'],
    }));
    syncVault(db, 'test', tmpDir);

    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_skeleton',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });

    const result = detectDrift(db, 'test', 'character', 'skeleton');
    expect(result.result).toBe('drift');
    expect(result.details).toHaveLength(1);
    expect(result.details[0].field).toBe('variant_count');
  });

  it('reports drift when encounter count mismatches', () => {
    upsertEncounter(db, { id: 'enc1', project_id: 'test', chapter: 'ch1', label: 'Enc 1', grid_rows: 3, grid_cols: 8 });

    // Canon says 3 encounters, registry has 1
    createVaultFile(tmpDir, 'ch1.md', makeFrontmatter({
      canon_id: 'chapter_ch1',
      kind: 'chapter',
      title: 'Chapter 1',
      encounter_count: 3,
    }));
    syncVault(db, 'test', tmpDir);

    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'chapter_ch1',
      target_type: 'chapter',
      target_id: 'ch1',
      link_type: 'describes',
    });

    const result = detectDrift(db, 'test', 'chapter', 'ch1');
    expect(result.result).toBe('drift');
    expect(result.details[0].field).toBe('encounter_count');
    expect(result.details[0].canon_value).toBe(3);
    expect(result.details[0].registry_value).toBe(1);
  });
});

// ─── Handoff Generation ──────────────────────────────────

describe('handoff generation', () => {
  beforeEach(() => {
    seedProject();
    upsertCharacter(db, { id: 'skeleton', project_id: 'test', display_name: 'Skeleton' });
  });

  it('generates handoff with canon + production summary', () => {
    createVaultFile(tmpDir, 'skeleton.md', makeFrontmatter({
      canon_id: 'char_skeleton',
      kind: 'character',
      title: 'Skeleton',
    }));
    syncVault(db, 'test', tmpDir);

    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_skeleton',
      target_type: 'character',
      target_id: 'skeleton',
      link_type: 'describes',
    });

    const handoff = generateHandoff(db, 'test', 'character', 'skeleton', 'production_brief');
    expect(handoff.scope_type).toBe('character');
    expect(handoff.scope_id).toBe('skeleton');
    expect(handoff.canon_summary.page_count).toBe(1);
    expect(handoff.production_summary).toHaveProperty('concept_status');
  });

  it('writes handoff artifact to disk when path provided', () => {
    const outputPath = path.join(tmpDir, 'handoff.json');
    generateHandoff(db, 'test', 'character', 'skeleton', 'production_brief', outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(content.scope_id).toBe('skeleton');
  });

  it('records handoff_artifacts row', () => {
    generateHandoff(db, 'test', 'character', 'skeleton', 'production_brief');

    const rows = db.prepare(
      "SELECT * FROM handoff_artifacts WHERE scope_type = 'character' AND scope_id = 'skeleton'",
    ).all();
    expect(rows).toHaveLength(1);
  });
});

// ─── Next Step ───────────────────────────────────────────

describe('next-step', () => {
  beforeEach(() => {
    seedProject();
  });

  it('suggests sync_vault when no pages registered', () => {
    const result = getCanonNextStep(db, 'test');
    expect(result.action).toBe('sync_vault');
  });

  it('suggests link_object when unlinked pages exist', () => {
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));
    syncVault(db, 'test', tmpDir);

    const result = getCanonNextStep(db, 'test');
    expect(result.action).toBe('link_object');
    expect(result.details).toHaveProperty('unlinked_count', 1);
  });

  it('suggests fix_drift when drift detected', () => {
    // Create page, link it, then inject a drift report
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));
    syncVault(db, 'test', tmpDir);
    upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_test',
      target_type: 'character',
      target_id: 'char1',
      link_type: 'describes',
    });

    // Inject a drift report
    db.prepare(`
      INSERT INTO canon_drift_reports (id, project_id, scope_type, scope_id, result, details_json)
      VALUES ('drift1', 'test', 'character', 'char1', 'drift', '[]')
    `).run();

    const result = getCanonNextStep(db, 'test');
    expect(result.action).toBe('fix_drift');
  });

  it('reports healthy when everything is linked and clean', () => {
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));
    syncVault(db, 'test', tmpDir);

    // Link a character so the page is linked
    upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_test',
      target_type: 'character',
      target_id: 'char1',
      link_type: 'describes',
    });

    const result = getCanonNextStep(db, 'test');
    expect(result.action).toBe('none');
  });
});

// ─── Timeline ────────────────────────────────────────────

describe('timeline', () => {
  it('returns chronological canon events', () => {
    seedProject();
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));
    syncVault(db, 'test', tmpDir);

    const timeline = getCanonTimeline(db, 'test', 'char_test');
    expect(timeline.length).toBeGreaterThan(0);
    // Should at least have a sync event
    const syncEvents = timeline.filter((e) => e.type === 'sync');
    expect(syncEvents.length).toBeGreaterThan(0);
  });

  it('includes drift reports in timeline', () => {
    seedProject();
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));
    syncVault(db, 'test', tmpDir);

    upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_test',
      target_type: 'character',
      target_id: 'char1',
      link_type: 'describes',
    });

    // Run drift detection which writes a report
    detectDrift(db, 'test', 'character', 'char1');

    const timeline = getCanonTimeline(db, 'test', 'char_test');
    const driftEvents = timeline.filter((e) => e.type === 'drift');
    expect(driftEvents.length).toBeGreaterThan(0);
  });

  it('includes link events in timeline', () => {
    seedProject();
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));
    syncVault(db, 'test', tmpDir);

    upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
    linkObject(db, {
      project_id: 'test',
      source_canon_id: 'char_test',
      target_type: 'character',
      target_id: 'char1',
      link_type: 'describes',
    });

    const timeline = getCanonTimeline(db, 'test', 'char_test');
    const linkEvents = timeline.filter((e) => e.type === 'link');
    expect(linkEvents).toHaveLength(1);
    expect(linkEvents[0].summary).toContain('character:char1');
  });

  it('includes snapshot events in timeline', () => {
    seedProject();
    createVaultFile(tmpDir, 'char.md', makeFrontmatter({
      canon_id: 'char_test',
      kind: 'character',
      title: 'Test',
    }));
    syncVault(db, 'test', tmpDir);

    createSnapshot(db, 'test', 'char_test', 'hash123', { v: 1 });

    const timeline = getCanonTimeline(db, 'test', 'char_test');
    const snapEvents = timeline.filter((e) => e.type === 'snapshot');
    expect(snapEvents).toHaveLength(1);
  });
});
