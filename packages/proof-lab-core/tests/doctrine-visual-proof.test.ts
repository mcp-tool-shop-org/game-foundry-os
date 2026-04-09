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
import { checkSprite } from '@mcptoolshop/proof-lab-core';

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

function writeTestSprite(name: string, buf: Buffer): string {
  const filePath = path.join(tmpDir, `${name}.png`);
  fs.writeFileSync(filePath, buf);
  return filePath;
}

function seedProject() {
  upsertProject(db, 'proj-dvp', 'Doctrine Visual Proof Project', '/tmp/dvp');
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctrine-visual-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('extended SpriteCheckResult fields', () => {
  it('computes silhouette_area correctly', () => {
    // 48x48, center 20x20 block filled
    const buf = makePNG(48, 48, (x, y) => {
      if (x >= 14 && x < 34 && y >= 14 && y < 34) return [120, 80, 60, 255];
      return [0, 0, 0, 0];
    });
    const filePath = writeTestSprite('area', buf);
    const result = checkSprite(filePath);

    expect(result.silhouette_area).toBe(400); // 20*20
  });

  it('computes silhouette_edge_count for a solid block', () => {
    // 48x48, center 20x20 block — perimeter should be ~76 (4*20 - 4 corners)
    const buf = makePNG(48, 48, (x, y) => {
      if (x >= 14 && x < 34 && y >= 14 && y < 34) return [120, 80, 60, 255];
      return [0, 0, 0, 0];
    });
    const filePath = writeTestSprite('edge', buf);
    const result = checkSprite(filePath);

    // Perimeter of a 20x20 block = 2*(20+20) - 4 = 76
    expect(result.silhouette_edge_count).toBe(76);
  });

  it('computes left/right half luminance correctly', () => {
    // Left half bright, right half dark
    const buf = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0]; // transparent border
      if (x < 24) return [200, 200, 200, 255]; // bright left
      return [40, 40, 40, 255]; // dark right
    });
    const filePath = writeTestSprite('halves', buf);
    const result = checkSprite(filePath);

    expect(result.left_half_luminance).toBeGreaterThan(150);
    expect(result.right_half_luminance).toBeLessThan(60);
  });

  it('left and right half luminance equal for uniform sprite', () => {
    const buf = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      return [100, 100, 100, 255];
    });
    const filePath = writeTestSprite('uniform', buf);
    const result = checkSprite(filePath);

    expect(Math.abs(result.left_half_luminance - result.right_half_luminance)).toBeLessThan(1);
  });
});

describe('perimeter complexity metric', () => {
  it('solid rectangle has low complexity', () => {
    const buf = makePNG(48, 48, (x, y) => {
      if (x >= 14 && x < 34 && y >= 14 && y < 34) return [120, 80, 60, 255];
      return [0, 0, 0, 0];
    });
    const filePath = writeTestSprite('rect', buf);
    const result = checkSprite(filePath);

    const p = result.silhouette_edge_count;
    const a = result.silhouette_area;
    const complexity = (p * p) / (4 * Math.PI * a);

    // Rectangle complexity should be moderate (>1.0 but not extreme)
    expect(complexity).toBeGreaterThan(1.0);
    expect(complexity).toBeLessThan(2.0);
  });

  it('checkerboard pattern has high complexity', () => {
    // Every other pixel filled — maximum edge density
    const buf = makePNG(48, 48, (x, y) => {
      if (x < 8 || x > 39 || y < 8 || y > 39) return [0, 0, 0, 0];
      if ((x + y) % 2 === 0) return [120, 80, 60, 255];
      return [0, 0, 0, 0];
    });
    const filePath = writeTestSprite('checker', buf);
    const result = checkSprite(filePath);

    const p = result.silhouette_edge_count;
    const a = result.silhouette_area;
    const complexity = (p * p) / (4 * Math.PI * a);

    // Checkerboard = very high complexity
    expect(complexity).toBeGreaterThan(3.0);
  });
});

describe('doctrine DEFAULT_CONFIG alignment', () => {
  it('uses doctrine occupancy thresholds (0.18-0.55) by default', () => {
    // Sprite with 15% occupancy — below doctrine min of 0.18
    const buf = makePNG(48, 48, (x, y) => {
      if (x >= 20 && x < 28 && y >= 20 && y < 28) return [120, 80, 60, 255];
      return [0, 0, 0, 0];
    });
    const filePath = writeTestSprite('sparse', buf);
    const result = checkSprite(filePath);

    // 8x8 / 48x48 = ~2.8% — well below 0.18
    expect(result.issues.some(i => i.startsWith('occupancy_too_low'))).toBe(true);
  });

  it('flags sprites above 55% occupancy', () => {
    // Sprite with ~70% fill
    const buf = makePNG(48, 48, (x, y) => {
      if (x < 2 || x > 45 || y < 2 || y > 45) return [0, 0, 0, 0]; // thin border
      return [120, 80, 60, 255];
    });
    const filePath = writeTestSprite('dense', buf);
    const result = checkSprite(filePath);

    // ~1936/2304 = ~84% — above 0.55
    expect(result.issues.some(i => i.startsWith('occupancy_too_high'))).toBe(true);
  });
});
