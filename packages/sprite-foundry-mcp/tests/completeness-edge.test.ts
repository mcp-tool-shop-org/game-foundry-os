import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { checkVariantCompleteness } from '../src/utils/completeness.js';
import type { VariantRow } from '@mcptoolshop/game-foundry-registry';

let tmpDir: string;

function makeTmp(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'completeness-edge-'));
  return tmpDir;
}

function makeVariant(overrides: Partial<VariantRow> = {}): VariantRow {
  return {
    id: 'test-variant',
    character_id: 'test-char',
    variant_type: 'base',
    phase: 1,
    pack_id: 'test-pack',
    concept_dir: null,
    directional_dir: null,
    sheet_path: null,
    pack_dir: null,
    sheet_present: 0,
    pack_present: 0,
    directions_present: 0,
    content_hash: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as VariantRow;
}

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

describe('completeness edge cases', () => {
  it('returns all-fail when project root does not exist', () => {
    const variant = makeVariant({ pack_id: 'some-pack' });
    const checks = checkVariantCompleteness('/nonexistent/root/path', variant);

    expect(checks.length).toBeGreaterThanOrEqual(4);
    expect(checks.every(c => c.pass === false)).toBe(true);
  });

  it('counts partial directionals correctly (3 of 5 dirs)', () => {
    const root = makeTmp();
    const dirBase = path.join(root, 'assets', 'sprites', 'directional', 'test-char');
    // Create only 3 of 5 expected dirs
    for (const d of ['front', 'front_34', 'side']) {
      fs.mkdirSync(path.join(dirBase, d), { recursive: true });
    }

    const variant = makeVariant({ pack_id: null });
    const checks = checkVariantCompleteness(root, variant);
    const dirCheck = checks.find(c => c.check === 'directional_complete');
    expect(dirCheck?.pass).toBe(false);
    expect(dirCheck?.detail).toContain('back_34');
    expect(dirCheck?.detail).toContain('back');
  });

  it('handles variant with concept_dir but no directional_dir', () => {
    const root = makeTmp();
    // Create concept dir with a PNG
    const cDir = path.join(root, 'my-concepts');
    fs.mkdirSync(cDir, { recursive: true });
    fs.writeFileSync(path.join(cDir, 'concept_01.png'), '');

    const variant = makeVariant({ concept_dir: cDir, pack_id: null });
    const checks = checkVariantCompleteness(root, variant);

    const conceptCheck = checks.find(c => c.check === 'concept_exists');
    expect(conceptCheck?.pass).toBe(true);

    const dirCheck = checks.find(c => c.check === 'directional_complete');
    expect(dirCheck?.pass).toBe(false);
  });

  it('pack check passes with exactly 8 PNGs, fails with 7', () => {
    const root = makeTmp();
    const packDir = path.join(root, 'assets', 'sprites', 'test-pack', 'assets', 'test-variant', 'albedo');
    fs.mkdirSync(packDir, { recursive: true });

    const allDirs = ['front.png', 'front_34.png', 'side.png', 'back_34.png', 'back.png', 'side_flip.png', 'front_34_flip.png', 'back_34_flip.png'];

    // Write only 7
    for (const f of allDirs.slice(0, 7)) {
      fs.writeFileSync(path.join(packDir, f), '');
    }

    const variant = makeVariant();
    const checks7 = checkVariantCompleteness(root, variant);
    const packCheck7 = checks7.find(c => c.check === 'pack_complete');
    expect(packCheck7?.pass).toBe(false);

    // Write the 8th
    fs.writeFileSync(path.join(packDir, allDirs[7]), '');
    const checks8 = checkVariantCompleteness(root, variant);
    const packCheck8 = checks8.find(c => c.check === 'pack_complete');
    expect(packCheck8?.pass).toBe(true);
  });
});
