import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack,
} from '@mcptoolshop/game-foundry-registry';
import { reportPlaceholders } from '../src/tools/reportPlaceholders.js';
import type Database from 'better-sqlite3';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'placeholders-edge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('reportPlaceholders edge cases', () => {
  it('throws for nonexistent project_id', () => {
    expect(() => reportPlaceholders(db, 'nonexistent'))
      .toThrow('Project not found');
  });

  it('reports variant with no pack_id as placeholder with reason', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertCharacter(db, { id: 'orphan', project_id: 'test', display_name: 'Orphan', role: 'enemy' });
    upsertVariant(db, { id: 'orphan', character_id: 'orphan', variant_type: 'base' });
    // No pack_id assigned

    const result = reportPlaceholders(db, 'test');
    expect(result.placeholder_count).toBe(1);
    expect(result.placeholders[0].reason).toContain('No pack assigned');
    expect(result.placeholders[0].pack).toBe('none');
  });

  it('does not count portrait-type variants', () => {
    upsertProject(db, 'test', 'Test', tmpDir);
    upsertPack(db, { id: 'enemies', project_id: 'test', pack_type: 'enemy', root_path: 'assets/sprites/enemies' });
    upsertCharacter(db, { id: 'hero', project_id: 'test', display_name: 'Hero', role: 'party' });
    upsertVariant(db, { id: 'hero-portrait', character_id: 'hero', variant_type: 'portrait', pack_id: 'enemies' });
    // Only a portrait variant — should not be counted

    const result = reportPlaceholders(db, 'test');
    expect(result.total_checked).toBe(0);
    expect(result.placeholder_count).toBe(0);
  });

  it('empty project returns 0 placeholders and 0 total_checked', () => {
    upsertProject(db, 'empty', 'Empty', tmpDir);

    const result = reportPlaceholders(db, 'empty');
    expect(result.placeholder_count).toBe(0);
    expect(result.total_checked).toBe(0);
    expect(result.placeholders).toEqual([]);
  });
});
