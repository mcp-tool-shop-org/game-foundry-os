import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseImportFile, auditImportSettings } from '../src/utils/godot-import.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-import-edge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const absPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

describe('parseImportFile edge cases', () => {
  it('returns defaults for empty/nonexistent .import file', () => {
    const data = parseImportFile(path.join(tmpDir, 'nonexistent.png.import'));
    expect(data.importer).toBe('');
    expect(data.compress_mode).toBe(0);
    expect(data.mipmaps).toBe(false);
    expect(data.detect_3d).toBe(false);
    expect(data.dest_files).toEqual([]);
  });

  it('extracts dest_files as array', () => {
    writeFile('test.png.import', `[remap]
importer="texture"
type="CompressedTexture2D"
path="res://.godot/imported/test.ctex"
dest_files=PackedStringArray("res://.godot/imported/test.ctex")

[params]
compress/mode=0
`);
    const data = parseImportFile(path.join(tmpDir, 'test.png.import'));
    expect(data.dest_files).toEqual(['res://.godot/imported/test.ctex']);
  });

  it('detects mipmaps enabled as pixel-art violation', () => {
    writeFile('mip.png.import', `[remap]
importer="texture"

[params]
compress/mode=0
mipmaps/generate=true
`);
    const data = parseImportFile(path.join(tmpDir, 'mip.png.import'));
    expect(data.mipmaps).toBe(true);
  });

  it('detects Detect 3D as pixel-art violation', () => {
    writeFile('det3d.png.import', `[remap]
importer="texture"

[params]
compress/mode=0
detect_3d/compress_to="vram_compressed"
`);
    const data = parseImportFile(path.join(tmpDir, 'det3d.png.import'));
    expect(data.detect_3d).toBe(true);
  });

  it('handles .import file with no [params] section', () => {
    writeFile('noparam.png.import', `[remap]
importer="texture"
type="CompressedTexture2D"
path="res://.godot/imported/noparam.ctex"
`);
    const data = parseImportFile(path.join(tmpDir, 'noparam.png.import'));
    expect(data.importer).toBe('texture');
    expect(data.compress_mode).toBe(0);
    expect(data.mipmaps).toBe(false);
  });
});

describe('auditImportSettings edge cases', () => {
  it('skips non-.import files in directory', () => {
    writeFile('assets/sprites/front.png', 'PNG DATA');
    writeFile('assets/sprites/readme.txt', 'just a text file');
    writeFile('assets/sprites/front.png.import', `[remap]
importer="texture"

[params]
compress/mode=0
mipmaps/generate=false
`);
    const result = auditImportSettings(tmpDir);
    expect(result.files_checked).toBe(1); // Only the .import file
    expect(result.pass).toBe(true);
  });
});
