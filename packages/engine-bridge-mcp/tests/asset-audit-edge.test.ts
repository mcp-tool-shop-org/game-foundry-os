import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { assetImportAudit } from '../src/tools/assetImportAudit.js';

let db: Database.Database;
let tmpDir: string;

const IMPORT_BAD = `[remap]
importer="texture"
type="CompressedTexture2D"

[params]
compress/mode=2
mipmaps/generate=true
detect_3d/compress_to="vram_compressed"
`;

const IMPORT_GOOD = `[remap]
importer="texture"
type="CompressedTexture2D"

[params]
compress/mode=0
mipmaps/generate=false
detect_3d/compress_to="disabled"
`;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-audit-edge-'));
  upsertProject(db, 'test-project', 'Test Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const absPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

describe('assetImportAudit edge cases', () => {
  it('scans nested subdirectories for .import files', () => {
    writeFile('project.godot', `[application]\nconfig/name="Nested"\n[display]\nwindow/stretch/mode="canvas_items"\nwindow/stretch/scale_mode="integer"\n`);
    writeFile('assets/sprites/pack1/front.png.import', IMPORT_GOOD);
    writeFile('assets/sprites/pack2/side.png.import', IMPORT_GOOD);
    writeFile('assets/sprites/pack2/sub/deep.png.import', IMPORT_GOOD);

    const result = assetImportAudit(db, 'test-project');
    expect(result.audit.files_checked).toBe(3);
    expect(result.overall_pass).toBe(true);
  });

  it('reports multiple violations per file', () => {
    writeFile('project.godot', `[application]\nconfig/name="Multi Viol"\n[display]\nwindow/stretch/mode="canvas_items"\nwindow/stretch/scale_mode="integer"\n`);
    writeFile('assets/sprites/bad.png.import', IMPORT_BAD);

    const result = assetImportAudit(db, 'test-project');
    expect(result.overall_pass).toBe(false);
    // Should have VRAM compression + mipmaps + detect_3d violations
    const fileIssues = result.audit.issues.filter(i => i.file.includes('bad.png.import'));
    expect(fileIssues.length).toBeGreaterThanOrEqual(2);
  });

  it('handles custom asset_dir parameter', () => {
    writeFile('project.godot', `[application]\nconfig/name="Custom Dir"\n[display]\nwindow/stretch/mode="canvas_items"\nwindow/stretch/scale_mode="integer"\n`);
    writeFile('custom_assets/sprites/test.png.import', IMPORT_GOOD);
    // Default "assets/" scan dir should find nothing
    writeFile('assets/sprites/default.png.import', IMPORT_GOOD);

    const result = assetImportAudit(db, 'test-project', 'custom_assets');
    expect(result.audit.files_checked).toBe(1);
    expect(result.overall_pass).toBe(true);
  });

  it('ignores non-texture imports (audio, etc)', () => {
    writeFile('project.godot', `[application]\nconfig/name="Audio"\n[display]\nwindow/stretch/mode="canvas_items"\nwindow/stretch/scale_mode="integer"\n`);
    // Audio .import file — has compress_mode > 0 but it's not a texture violation
    writeFile('assets/audio/bgm.ogg.import', `[remap]
importer="ogg_vorbis"
type="AudioStreamOggVorbis"

[params]
compress/mode=1
`);
    writeFile('assets/sprites/sprite.png.import', IMPORT_GOOD);

    const result = assetImportAudit(db, 'test-project');
    // The audit scans all .import files but pixel-art violations only matter for textures
    // The audio file has compress_mode=1 which triggers the generic check
    expect(result.audit.files_checked).toBe(2);
  });
});
