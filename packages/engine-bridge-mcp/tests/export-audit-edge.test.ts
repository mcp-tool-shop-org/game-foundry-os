import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { exportAudit } from '../src/tools/exportAudit.js';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-audit-edge-'));
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

describe('exportAudit edge cases', () => {
  it('detects unnamed/empty preset as warning', () => {
    writeFile('export_presets.cfg', `[preset.0]
name=""
platform="Linux/X11"
runnable=true
`);
    const result = exportAudit(db, 'test-project');
    // Has a preset so no error, but empty name is a warning
    expect(result.pass).toBe(true); // warnings don't fail
    expect(result.issues.some(i => i.issue.includes('empty name') && i.severity === 'warning')).toBe(true);
  });

  it('handles export_presets.cfg with multiple presets', () => {
    writeFile('export_presets.cfg', `[preset.0]
name="Linux/X11"
platform="Linux/X11"
runnable=true

[preset.0.options]
custom_template/debug=""

[preset.1]
name="Windows Desktop"
platform="Windows Desktop"
runnable=false

[preset.2]
name="macOS"
platform="macOS"
runnable=false
`);
    const result = exportAudit(db, 'test-project');
    expect(result.pass).toBe(true);
    expect(result.presets).toHaveLength(3);
    expect(result.presets[0].name).toBe('Linux/X11');
    expect(result.presets[1].name).toBe('Windows Desktop');
    expect(result.presets[2].name).toBe('macOS');
    expect(result.presets[0].runnable).toBe(true);
    expect(result.presets[2].runnable).toBe(false);
  });

  it('reports missing platform in preset', () => {
    writeFile('export_presets.cfg', `[preset.0]
name="No Platform"
runnable=true
`);
    const result = exportAudit(db, 'test-project');
    expect(result.presets).toHaveLength(1);
    expect(result.presets[0].platform).toBe('');
  });

  it('handles malformed export_presets.cfg gracefully', () => {
    writeFile('export_presets.cfg', `; This file is corrupt
random_key=random_value
some_line_without_section
`);
    const result = exportAudit(db, 'test-project');
    // No valid presets found
    expect(result.presets).toHaveLength(0);
    expect(result.pass).toBe(false);
    expect(result.issues.some(i => i.issue.includes('No export presets'))).toBe(true);
  });
});
