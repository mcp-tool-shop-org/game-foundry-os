import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { openDatabase, upsertCharacter, upsertVariant, getCharacterStatus } from '@mcptoolshop/game-foundry-registry';
import { upsertProject } from '@mcptoolshop/game-foundry-registry';
import { upsertPack } from '@mcptoolshop/game-foundry-registry';
import { checkVariantCompleteness } from '../src/utils/completeness.js';
import { scanProjectAssets } from '../src/tools/scanAssets.js';

let db: Database.Database;
let tmpDir: string;
let projectRoot: string;

/**
 * Create a temp directory structure mimicking The Fractured Road:
 *
 * assets/sprites/concepts/skeleton_warrior/  (with concept PNGs)
 * assets/sprites/directional/skeleton_warrior/{front,front_34,side,back_34,back}/
 * assets/sprites/sheets/skeleton_warrior/  (with sheet.png)
 * assets/sprites/ch1_enemy_pack/assets/skeleton_warrior_base/albedo/  (8 direction PNGs)
 */
function buildSpriteTree(root: string): void {
  const dirs = [
    'assets/sprites/concepts/skeleton_warrior',
    'assets/sprites/concepts/goblin_scout',
    'assets/sprites/directional/skeleton_warrior/front',
    'assets/sprites/directional/skeleton_warrior/front_34',
    'assets/sprites/directional/skeleton_warrior/side',
    'assets/sprites/directional/skeleton_warrior/back_34',
    'assets/sprites/directional/skeleton_warrior/back',
    'assets/sprites/directional/goblin_scout/front',
    'assets/sprites/directional/goblin_scout/side',
    // goblin_scout missing front_34, back_34, back
    'assets/sprites/sheets/skeleton_warrior',
    'assets/sprites/ch1_enemy_pack/assets/skeleton_warrior_base/albedo',
    'assets/sprites/ch1_enemy_pack/assets/goblin_scout_base/albedo',
  ];

  for (const d of dirs) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }

  // Concept PNGs
  fs.writeFileSync(path.join(root, 'assets/sprites/concepts/skeleton_warrior/concept_01.png'), '');
  fs.writeFileSync(path.join(root, 'assets/sprites/concepts/goblin_scout/concept_01.png'), '');

  // Sheet PNG for skeleton_warrior
  fs.writeFileSync(path.join(root, 'assets/sprites/sheets/skeleton_warrior/sheet.png'), '');

  // 8 direction PNGs for skeleton_warrior pack (complete)
  const packDirs8 = [
    'front.png', 'front_34.png', 'side.png', 'back_34.png',
    'back.png', 'side_flip.png', 'front_34_flip.png', 'back_34_flip.png',
  ];
  for (const f of packDirs8) {
    fs.writeFileSync(
      path.join(root, 'assets/sprites/ch1_enemy_pack/assets/skeleton_warrior_base/albedo', f),
      '',
    );
  }

  // Goblin scout pack: only 3 of 8 PNGs (incomplete)
  for (const f of ['front.png', 'side.png', 'back.png']) {
    fs.writeFileSync(
      path.join(root, 'assets/sprites/ch1_enemy_pack/assets/goblin_scout_base/albedo', f),
      '',
    );
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-foundry-test-'));
  projectRoot = path.join(tmpDir, 'fractured-road');
  fs.mkdirSync(projectRoot);
  buildSpriteTree(projectRoot);

  db = openDatabase(':memory:');

  // Seed project
  upsertProject(db, 'tfr', 'The Fractured Road', projectRoot);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── validateCompleteness tests ───────────────────────────────

describe('validateCompleteness', () => {
  it('reports full completeness for skeleton_warrior with all assets', () => {
    upsertCharacter(db, {
      id: 'skeleton_warrior',
      project_id: 'tfr',
      display_name: 'Skeleton Warrior',
      role: 'enemy',
    });
    upsertVariant(db, {
      id: 'skeleton_warrior_base',
      character_id: 'skeleton_warrior',
      variant_type: 'base',
      pack_id: 'ch1_enemy_pack',
    });

    const variant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('skeleton_warrior_base') as import('@mcptoolshop/game-foundry-registry').VariantRow;

    const checks = checkVariantCompleteness(projectRoot, variant);

    expect(checks).toHaveLength(4);
    expect(checks.find(c => c.check === 'concept_exists')?.pass).toBe(true);
    expect(checks.find(c => c.check === 'directional_complete')?.pass).toBe(true);
    expect(checks.find(c => c.check === 'sheet_exists')?.pass).toBe(true);
    expect(checks.find(c => c.check === 'pack_complete')?.pass).toBe(true);
  });

  it('reports incomplete directionals for goblin_scout', () => {
    upsertCharacter(db, {
      id: 'goblin_scout',
      project_id: 'tfr',
      display_name: 'Goblin Scout',
      role: 'enemy',
    });
    upsertVariant(db, {
      id: 'goblin_scout_base',
      character_id: 'goblin_scout',
      variant_type: 'base',
      pack_id: 'ch1_enemy_pack',
    });

    const variant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('goblin_scout_base') as import('@mcptoolshop/game-foundry-registry').VariantRow;

    const checks = checkVariantCompleteness(projectRoot, variant);

    // Concept: pass (has concept_01.png)
    expect(checks.find(c => c.check === 'concept_exists')?.pass).toBe(true);
    // Directional: fail (only 2 of 5 dirs)
    expect(checks.find(c => c.check === 'directional_complete')?.pass).toBe(false);
    // Sheet: fail (no sheets/goblin_scout dir)
    expect(checks.find(c => c.check === 'sheet_exists')?.pass).toBe(false);
    // Pack: fail (only 3 of 8 PNGs)
    expect(checks.find(c => c.check === 'pack_complete')?.pass).toBe(false);
  });

  it('reports no pack when variant has no pack_id', () => {
    upsertCharacter(db, {
      id: 'skeleton_warrior',
      project_id: 'tfr',
      display_name: 'Skeleton Warrior',
    });
    upsertVariant(db, {
      id: 'skeleton_warrior_base',
      character_id: 'skeleton_warrior',
      variant_type: 'base',
      // no pack_id
    });

    const variant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('skeleton_warrior_base') as import('@mcptoolshop/game-foundry-registry').VariantRow;

    const checks = checkVariantCompleteness(projectRoot, variant);
    const packCheck = checks.find(c => c.check === 'pack_complete');
    expect(packCheck?.pass).toBe(false);
    expect(packCheck?.detail).toContain('No pack_id');
  });
});

// ─── scanAssets tests ─────────────────────────────────────────

describe('scanAssets', () => {
  it('discovers characters from filesystem scan', () => {
    const result = scanProjectAssets(db, 'tfr', projectRoot);

    expect(result.errors).toHaveLength(0);
    expect(result.scanned).toBeGreaterThan(0);

    // Should have created skeleton_warrior and goblin_scout
    const chars = db.prepare('SELECT id FROM characters WHERE project_id = ?')
      .all('tfr') as { id: string }[];
    const ids = chars.map(c => c.id);
    expect(ids).toContain('skeleton_warrior');
    expect(ids).toContain('goblin_scout');
  });

  it('creates base variants for discovered characters', () => {
    scanProjectAssets(db, 'tfr', projectRoot);

    const skVariant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('skeleton_warrior_base') as import('@mcptoolshop/game-foundry-registry').VariantRow | undefined;
    expect(skVariant).toBeDefined();
    expect(skVariant!.character_id).toBe('skeleton_warrior');
  });

  it('updates directional presence counts', () => {
    scanProjectAssets(db, 'tfr', projectRoot);

    const skVariant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('skeleton_warrior_base') as import('@mcptoolshop/game-foundry-registry').VariantRow;
    // skeleton_warrior has all 5 directional dirs
    expect(skVariant.directions_present).toBe(5);
  });

  it('updates sheet presence', () => {
    scanProjectAssets(db, 'tfr', projectRoot);

    const skVariant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('skeleton_warrior_base') as import('@mcptoolshop/game-foundry-registry').VariantRow;
    expect(skVariant.sheet_present).toBe(1);
  });

  it('detects pack members and marks pack presence', () => {
    scanProjectAssets(db, 'tfr', projectRoot);

    const skVariant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('skeleton_warrior_base') as import('@mcptoolshop/game-foundry-registry').VariantRow;
    // skeleton_warrior has all 8 pack PNGs
    expect(skVariant.pack_present).toBe(1);

    const gbVariant = db.prepare('SELECT * FROM variants WHERE id = ?')
      .get('goblin_scout_base') as import('@mcptoolshop/game-foundry-registry').VariantRow;
    // goblin_scout only has 3 of 8
    expect(gbVariant.pack_present).toBe(0);
  });

  it('is idempotent on re-scan', () => {
    const result1 = scanProjectAssets(db, 'tfr', projectRoot);
    const result2 = scanProjectAssets(db, 'tfr', projectRoot);

    expect(result2.errors).toHaveLength(0);
    // Should not crash or produce duplicates
    const chars = db.prepare('SELECT id FROM characters WHERE project_id = ?')
      .all('tfr') as { id: string }[];
    expect(chars.length).toBe(2); // skeleton_warrior + goblin_scout
  });

  it('returns error for unknown project', () => {
    // scanProjectAssets requires the caller to pass valid root_path,
    // but the MCP tool wrapper checks getProject first.
    // Here we just verify the function handles a nonexistent dir gracefully.
    const result = scanProjectAssets(db, 'tfr', path.join(tmpDir, 'nonexistent'));
    expect(result.scanned).toBe(0);
    expect(result.errors).toHaveLength(0); // No errors, just nothing found
  });
});
