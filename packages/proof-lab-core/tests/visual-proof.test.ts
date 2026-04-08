import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PNG } from 'pngjs';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { checkSprite, runVisualSuite } from '@mcptoolshop/proof-lab-core';

let db: Database.Database;
let tmpDir: string;

function makePNG(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number, number]): Buffer {
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

function writeTestSprite(name: string, buf: Buffer): string {
  const filePath = path.join(tmpDir, `${name}.png`);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-proof-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('checkSprite', () => {
  it('passes a good transparent sprite', () => {
    const buf = makePNG(48, 48, (x, y) => {
      // Transparent border, solid center
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [100, 60, 40, 255];
    });
    const filePath = writeTestSprite('good', buf);
    const result = checkSprite(filePath);

    expect(result.has_alpha).toBe(true);
    expect(result.corners_transparent).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.occupancy).toBeGreaterThan(0.25);
    expect(result.occupancy).toBeLessThan(0.95);
  });

  it('detects opaque background', () => {
    const buf = makePNG(48, 48, () => [189, 189, 177, 255]);
    const filePath = writeTestSprite('opaque', buf);
    const result = checkSprite(filePath);

    expect(result.has_alpha).toBe(false);
    expect(result.corners_transparent).toBe(false);
    expect(result.issues).toContain('background_not_transparent');
  });

  it('detects corners not transparent', () => {
    const buf = makePNG(48, 48, (x, y) => {
      // Only inner area transparent
      if (x > 5 && x < 42 && y > 5 && y < 42) return [0, 0, 0, 0];
      return [200, 200, 200, 255];
    });
    const filePath = writeTestSprite('corners', buf);
    const result = checkSprite(filePath);

    expect(result.corners_transparent).toBe(false);
    expect(result.issues).toContain('corners_not_transparent');
  });

  it('detects occupancy too low', () => {
    const buf = makePNG(48, 48, (x, y) => {
      // Tiny dot in center
      if (x >= 22 && x <= 26 && y >= 22 && y <= 26) return [100, 50, 50, 255];
      return [0, 0, 0, 0];
    });
    const filePath = writeTestSprite('tiny', buf);
    const result = checkSprite(filePath);

    expect(result.occupancy).toBeLessThan(0.05);
    expect(result.issues.some(i => i.startsWith('occupancy_too_low'))).toBe(true);
  });

  it('detects occupancy too high (no transparency)', () => {
    const buf = makePNG(48, 48, () => [100, 80, 60, 255]);
    const filePath = writeTestSprite('full', buf);
    const result = checkSprite(filePath);

    expect(result.occupancy).toBeGreaterThan(0.95);
    expect(result.issues.some(i => i.startsWith('occupancy_too_high'))).toBe(true);
  });

  it('detects sprite too large', () => {
    const buf = makePNG(512, 512, (x, y) => {
      if (x < 10 || x > 500 || y < 10 || y > 500) return [0, 0, 0, 0];
      return [100, 80, 60, 255];
    });
    const filePath = writeTestSprite('huge', buf);
    const result = checkSprite(filePath);

    expect(result.issues.some(i => i.startsWith('too_large'))).toBe(true);
  });

  it('detects matte fringe', () => {
    const buf = makePNG(48, 48, (x, y) => {
      // Thick semi-opaque border
      if (x < 3 || x > 44 || y < 3 || y > 44) return [150, 150, 150, 128];
      return [100, 60, 40, 255];
    });
    const filePath = writeTestSprite('fringe', buf);
    const result = checkSprite(filePath);

    expect(result.fringe_pixels).toBeGreaterThan(20);
    expect(result.issues.some(i => i.startsWith('matte_fringe'))).toBe(true);
  });

  it('detects low luminance', () => {
    const buf = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [10, 10, 10, 255]; // Very dark
    });
    const filePath = writeTestSprite('dark', buf);
    const result = checkSprite(filePath);

    expect(result.avg_luminance).toBeLessThan(40);
    expect(result.issues.some(i => i.startsWith('low_luminance'))).toBe(true);
  });

  it('computes correct bounding box', () => {
    const buf = makePNG(48, 48, (x, y) => {
      if (x >= 10 && x <= 30 && y >= 5 && y <= 40) return [100, 80, 60, 255];
      return [0, 0, 0, 0];
    });
    const filePath = writeTestSprite('bbox', buf);
    const result = checkSprite(filePath);

    expect(result.bbox.x).toBe(10);
    expect(result.bbox.y).toBe(5);
    expect(result.bbox.w).toBe(21);
    expect(result.bbox.h).toBe(36);
  });
});

describe('runVisualSuite', () => {
  it('runs against a variant with sprites on disk', () => {
    upsertProject(db, 'proj-vs', 'Visual Test', tmpDir);

    // Create variant in DB
    db.prepare("INSERT INTO characters (id, project_id, display_name) VALUES ('char1', 'proj-vs', 'Test')").run();
    db.prepare("INSERT INTO variants (id, character_id, variant_type, pack_id, pack_present, directions_present, production_state) VALUES ('var1', 'char1', 'base', 'test-pack', 1, 8, 'pack_sliced')").run();

    // Create sprite files on disk
    const albedoDir = path.join(tmpDir, 'assets', 'sprites', 'test-pack', 'assets', 'var1', 'albedo');
    fs.mkdirSync(albedoDir, { recursive: true });

    const goodSprite = makePNG(48, 48, (x, y) => {
      if (x < 6 || x > 41 || y < 4 || y > 43) return [0, 0, 0, 0];
      return [120, 80, 60, 255];
    });

    for (const dir of ['front', 'front_left', 'left', 'back_left', 'back', 'back_right', 'right', 'front_right']) {
      fs.writeFileSync(path.join(albedoDir, `${dir}.png`), goodSprite);
    }

    const result = runVisualSuite(db, 'proj-vs', 'variant', 'var1', tmpDir);

    expect(result.passed).toBe(true);
    expect(result.assertions.some(a => a.status === 'pass')).toBe(true);
  });

  it('fails when sprites have opaque backgrounds', () => {
    upsertProject(db, 'proj-vs', 'Visual Test', tmpDir);
    db.prepare("INSERT INTO characters (id, project_id, display_name) VALUES ('char1', 'proj-vs', 'Test')").run();
    db.prepare("INSERT INTO variants (id, character_id, variant_type, pack_id, pack_present, directions_present, production_state) VALUES ('var1', 'char1', 'base', 'test-pack', 1, 8, 'pack_sliced')").run();

    const albedoDir = path.join(tmpDir, 'assets', 'sprites', 'test-pack', 'assets', 'var1', 'albedo');
    fs.mkdirSync(albedoDir, { recursive: true });

    // Opaque sprite — this is exactly the bug we hit
    const opaqueSprite = makePNG(48, 48, (x, y) => {
      if (x > 10 && x < 38 && y > 8 && y < 40) return [50, 50, 45, 255];
      return [189, 189, 177, 255]; // Gray background, fully opaque
    });

    for (const dir of ['front', 'front_left', 'left', 'back_left', 'back', 'back_right', 'right', 'front_right']) {
      fs.writeFileSync(path.join(albedoDir, `${dir}.png`), opaqueSprite);
    }

    const result = runVisualSuite(db, 'proj-vs', 'variant', 'var1', tmpDir);

    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.message.includes('background_not_transparent') || a.message.includes('occupancy_too_high'))).toBe(true);
  });

  it('is a blocking suite — affects freeze readiness', () => {
    upsertProject(db, 'proj-vs', 'Visual Test', tmpDir);

    // Check the suite is registered as blocking
    db.prepare("INSERT INTO characters (id, project_id, display_name) VALUES ('char1', 'proj-vs', 'Test')").run();
    db.prepare("INSERT INTO variants (id, character_id, variant_type, pack_id, pack_present, directions_present, production_state) VALUES ('var1', 'char1', 'base', 'test-pack', 1, 8, 'pack_sliced')").run();

    const albedoDir = path.join(tmpDir, 'assets', 'sprites', 'test-pack', 'assets', 'var1', 'albedo');
    fs.mkdirSync(albedoDir, { recursive: true });

    const goodSprite = makePNG(48, 48, (x, y) => {
      if (x < 6 || x > 41 || y < 4 || y > 43) return [0, 0, 0, 0];
      return [120, 80, 60, 255];
    });
    fs.writeFileSync(path.join(albedoDir, 'front.png'), goodSprite);

    runVisualSuite(db, 'proj-vs', 'variant', 'var1', tmpDir);

    const suite = db.prepare(
      "SELECT * FROM proof_suites WHERE suite_key = 'visual_integrity'"
    ).get() as any;
    expect(suite).toBeDefined();
    expect(suite.is_blocking).toBe(1);
  });
});
