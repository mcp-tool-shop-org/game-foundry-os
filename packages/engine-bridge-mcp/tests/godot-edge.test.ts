import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { packAlbedoDir, directionalSourceDir, portraitPath, checkDirectionalSource } from '../src/utils/godot.js';

const ROOT = '/project/root';

describe('godot utility edge cases', () => {
  it('packAlbedoDir produces correct path segments', () => {
    const result = packAlbedoDir(ROOT, 'ch1-enemies', 'grubblade');
    expect(result).toBe(path.join(ROOT, 'assets', 'sprites', 'ch1-enemies', 'assets', 'grubblade', 'albedo'));
  });

  it('directionalSourceDir produces correct path segments', () => {
    const result = directionalSourceDir(ROOT, 'riot_husk');
    expect(result).toBe(path.join(ROOT, 'assets', 'sprites', 'directional', 'riot_husk'));
  });

  it('portraitPath lowercases character name', () => {
    const result = portraitPath(ROOT, 'Marshal Avar', '80x80');
    expect(result).toBe(path.join(ROOT, 'assets', 'portraits', 'gate_test', 'marshal avar_80x80.png'));
  });

  it('checkDirectionalSource returns 0 for nonexistent character', () => {
    const result = checkDirectionalSource('/nonexistent/path', 'nobody');
    expect(result.dirs_present).toBe(0);
    expect(result.total_frames).toBe(0);
    expect(result.complete).toBe(false);
  });
});
