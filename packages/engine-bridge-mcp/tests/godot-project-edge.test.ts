import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseIniSections, parseGodotValue } from '../src/utils/godot-project.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-proj-edge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const absPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

// ─── parseIniSections ──────────────────────────────────────

describe('parseIniSections', () => {
  it('returns empty map for empty file', () => {
    const sections = parseIniSections('');
    // Should have only the default '' section with no entries
    expect(sections.size).toBe(1);
    expect(sections.get('')!.size).toBe(0);
  });

  it('handles sections with inline comments (;)', () => {
    const content = `; This is a comment
[application]
config/name="Test"
; Another comment
config/features=PackedStringArray("4.6")
`;
    const sections = parseIniSections(content);
    const app = sections.get('application');
    expect(app).toBeDefined();
    expect(app!.get('config/name')).toBe('Test');
    expect(app!.get('config/features')).toEqual(['4.6']);
  });

  it('handles keys with no section header (global keys)', () => {
    const content = `global_key="global_value"
[section1]
key1="val1"
`;
    const sections = parseIniSections(content);
    // Global key stored under empty-string section
    expect(sections.get('')!.get('global_key')).toBe('global_value');
    expect(sections.get('section1')!.get('key1')).toBe('val1');
  });
});

// ─── parseGodotValue edge cases ────────────────────────────

describe('parseGodotValue edge cases', () => {
  it('returns empty string for empty input', () => {
    const result = parseGodotValue('');
    expect(result).toBe('');
  });

  it('handles Vector2i with spaces around commas', () => {
    const result = parseGodotValue('Vector2i( 10 , 20 )');
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('handles PackedStringArray with empty entries', () => {
    const result = parseGodotValue('PackedStringArray("")');
    expect(result).toEqual(['']);
  });

  it('handles nested quoted strings with colons', () => {
    const result = parseGodotValue('"res://path/to/resource.gd"');
    expect(result).toBe('res://path/to/resource.gd');
  });

  it('handles raw unquoted path strings (res://path)', () => {
    // Unquoted non-numeric non-boolean strings are returned as-is
    const result = parseGodotValue('res://path/to/resource.gd');
    expect(result).toBe('res://path/to/resource.gd');
  });
});
