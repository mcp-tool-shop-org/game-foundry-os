import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { conceptDir, directionalDir, sheetDir, packAssetDir, spritesRoot } from '../src/utils/paths.js';

const ROOT = '/project/root';

describe('path utilities', () => {
  it('conceptDir resolves to assets/sprites/concepts/{id}', () => {
    const result = conceptDir(ROOT, 'riot_husk');
    expect(result).toBe(path.join(ROOT, 'assets', 'sprites', 'concepts', 'riot_husk'));
  });

  it('directionalDir resolves to assets/sprites/directional/{id}', () => {
    const result = directionalDir(ROOT, 'riot_husk');
    expect(result).toBe(path.join(ROOT, 'assets', 'sprites', 'directional', 'riot_husk'));
  });

  it('sheetDir resolves to assets/sprites/sheets/{id}', () => {
    const result = sheetDir(ROOT, 'riot_husk');
    expect(result).toBe(path.join(ROOT, 'assets', 'sprites', 'sheets', 'riot_husk'));
  });

  it('packAssetDir resolves to assets/sprites/{pack}/assets/{variant}/albedo', () => {
    const result = packAssetDir(ROOT, 'ch1-enemies', 'grubblade');
    expect(result).toBe(path.join(ROOT, 'assets', 'sprites', 'ch1-enemies', 'assets', 'grubblade', 'albedo'));
  });

  it('spritesRoot resolves to assets/sprites', () => {
    const result = spritesRoot(ROOT);
    expect(result).toBe(path.join(ROOT, 'assets', 'sprites'));
  });
});
