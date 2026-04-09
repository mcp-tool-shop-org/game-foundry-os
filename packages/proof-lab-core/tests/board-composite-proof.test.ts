import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';
import {
  openDatabase,
  upsertProject,
  upsertRenderDoctrine,
} from '@mcptoolshop/game-foundry-registry';
import { runBoardCompositeSuite } from '@mcptoolshop/proof-lab-core';

let db: Database.Database;
let tmpDir: string;

function makePNG(
  width: number,
  height: number,
  fillFn: (x: number, y: number) => [number, number, number, number],
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = fillFn(x, y);
      const idx = (y * width + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

function seedProject() {
  upsertProject(db, 'proj-bc', 'Board Composite Project', tmpDir);
}

function registerVariantWithSprite(
  variantId: string,
  characterId: string,
  packId: string,
  spriteBuf: Buffer,
) {
  // Register character
  db.prepare(`
    INSERT OR IGNORE INTO characters (id, project_id, display_name, chapter_primary)
    VALUES (?, 'proj-bc', ?, 'ch1')
  `).run(characterId, characterId);

  // Register variant
  db.prepare(`
    INSERT OR IGNORE INTO variants (id, character_id, variant_type, pack_id, canonical_pack_name, production_state, portrait_state)
    VALUES (?, ?, 'base', ?, ?, 'pack_sliced', 'none')
  `).run(variantId, characterId, packId, packId);

  // Create pack directory structure matching packAlbedoDir pattern
  const albedoDir = path.join(tmpDir, 'assets', 'sprites', packId, 'assets', variantId, 'albedo');
  fs.mkdirSync(albedoDir, { recursive: true });
  fs.writeFileSync(path.join(albedoDir, 'front.png'), spriteBuf);
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-composite-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runBoardCompositeSuite', () => {
  it('passes for bright sprite with good contrast', () => {
    seedProject();
    const brightSprite = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [160, 140, 120, 255]; // luminance ~140
    });
    registerVariantWithSprite('knight_base', 'knight', 'knights', brightSprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'knight_base', tmpDir);

    // lum 140 vs dark(30)=110, mid(128)=12, noisy(100)=40
    // dark passes (110 >= 40), mid fails (12 < 40), noisy passes (40 >= 30)
    const darkContrast = result.assertions.find(a => a.key === 'knight_base_dark_contrast');
    expect(darkContrast?.status).toBe('pass');
  });

  it('fails dark_contrast for very dark sprites', () => {
    seedProject();
    const darkSprite = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [25, 20, 15, 255]; // luminance ~21
    });
    registerVariantWithSprite('shadow_base', 'shadow', 'shadows', darkSprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'shadow_base', tmpDir);

    // lum 21 vs dark(30) = delta 9, which is < 40
    const darkContrast = result.assertions.find(a => a.key === 'shadow_base_dark_contrast');
    expect(darkContrast?.status).toBe('fail');
  });

  it('noisy_survival uses relaxed threshold (0.75x)', () => {
    seedProject();
    // Sprite with luminance ~130, vs noisy bg 100 = delta 30
    // Full threshold = 40, relaxed = 30. Delta 30 = exactly at boundary
    const sprite = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [130, 130, 130, 255]; // luminance 130
    });
    registerVariantWithSprite('mid_base', 'mid_unit', 'mids', sprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'mid_base', tmpDir);

    const noisyContrast = result.assertions.find(a => a.key === 'mid_base_noisy_contrast');
    expect(noisyContrast?.status).toBe('pass'); // delta 30 >= 30 (40*0.75)
  });

  it('gameplay_scale warns for tiny sprites', () => {
    seedProject();
    const tinySprite = makePNG(16, 16, (x, y) => {
      if (x < 2 || x > 13 || y < 2 || y > 13) return [0, 0, 0, 0];
      return [120, 100, 80, 255];
    });
    registerVariantWithSprite('tiny_base', 'tiny', 'tinies', tinySprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'tiny_base', tmpDir);

    const scaleCheck = result.assertions.find(a => a.key === 'tiny_base_gameplay_scale');
    expect(scaleCheck?.status).toBe('warn'); // 16 < 48*0.5 = 24
  });

  it('gameplay_scale passes for properly sized sprites', () => {
    seedProject();
    const goodSprite = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [120, 100, 80, 255];
    });
    registerVariantWithSprite('good_base', 'good', 'goods', goodSprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'good_base', tmpDir);

    const scaleCheck = result.assertions.find(a => a.key === 'good_base_gameplay_scale');
    expect(scaleCheck?.status).toBe('pass'); // 48 >= 24
  });

  it('silhouette_survival fails for nearly empty sprites', () => {
    seedProject();
    // Very sparse — only 4 pixels visible in center
    const sparseSprite = makePNG(48, 48, (x, y) => {
      if (x >= 23 && x <= 24 && y >= 23 && y <= 24) return [120, 100, 80, 255];
      return [0, 0, 0, 0];
    });
    registerVariantWithSprite('sparse_base', 'sparse', 'sparses', sparseSprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'sparse_base', tmpDir);

    const silCheck = result.assertions.find(a => a.key === 'sparse_base_silhouette_survival');
    expect(silCheck?.status).toBe('fail'); // 4/2304 = 0.17% < 18%
  });

  it('uses doctrine board_test_backgrounds', () => {
    seedProject();
    upsertRenderDoctrine(db, {
      project_id: 'proj-bc',
      board_test_backgrounds_json: '["dark"]', // only dark
    });
    const sprite = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [120, 100, 80, 255];
    });
    registerVariantWithSprite('filtered_base', 'filtered', 'filtereds', sprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'filtered_base', tmpDir);

    // Should only have dark_contrast, not mid or noisy
    const contrastAssertions = result.assertions.filter(a => a.key.includes('_contrast'));
    expect(contrastAssertions).toHaveLength(1);
    expect(contrastAssertions[0].key).toContain('dark');
  });

  it('alpha_correctness passes for clean sprites', () => {
    seedProject();
    const cleanSprite = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [120, 100, 80, 255];
    });
    registerVariantWithSprite('clean_base', 'clean', 'cleans', cleanSprite);

    const result = runBoardCompositeSuite(db, 'proj-bc', 'variant', 'clean_base', tmpDir);

    const alphaCheck = result.assertions.find(a => a.key === 'clean_base_alpha_correctness');
    expect(alphaCheck?.status).toBe('pass');
  });

  it('registers as blocking proof suite', () => {
    seedProject();
    const sprite = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [120, 100, 80, 255];
    });
    registerVariantWithSprite('block_base', 'block', 'blocks', sprite);

    runBoardCompositeSuite(db, 'proj-bc', 'variant', 'block_base', tmpDir);

    const suite = db.prepare(
      "SELECT * FROM proof_suites WHERE suite_key = 'board_composite'"
    ).get() as any;
    expect(suite).toBeDefined();
    expect(suite.is_blocking).toBe(1);
  });
});
