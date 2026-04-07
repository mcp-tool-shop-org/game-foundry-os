import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  openDatabase, listCharacters, listEncounters, getFreezeHistory,
} from '@mcptoolshop/game-foundry-registry';
import { bootstrap } from '../src/scan-tfr.js';
import type Database from 'better-sqlite3';

const TFR_ROOT = 'F:/AI/the-fractured-road';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-edge-'));
});

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('bootstrap edge cases', () => {
  it('is idempotent — running twice produces same character/variant counts', () => {
    const stats1 = bootstrap(db, TFR_ROOT);
    const stats2 = bootstrap(db, TFR_ROOT);

    expect(stats2.characters).toBe(stats1.characters);
    expect(stats2.variants).toBe(stats1.variants);
    expect(stats2.encounters).toBe(stats1.encounters);
    expect(stats2.packs).toBe(stats1.packs);
  });

  it('handles project root with no manifest.json gracefully', () => {
    // Empty temp dir, no manifest.json
    const stats = bootstrap(db, tmpDir);
    // Should still register party characters + encounters
    expect(stats.packs).toBe(1); // Only party pack (no enemy pack without manifest)
    const party = listCharacters(db, { project_id: 'the-fractured-road' })
      .filter(c => c.role === 'party');
    expect(party).toHaveLength(6);
  });

  it('handles project root with no directional sprites gracefully', () => {
    // Create manifest but no actual sprites
    const manifestDir = path.join(tmpDir, 'assets', 'sprites', 'ch1-enemies');
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(path.join(manifestDir, 'manifest.json'), JSON.stringify({
      pack: 'ch1-enemies', chapter: 1, sprite_size: 48, directions: 8,
      characters: [{ variant: 'grubblade', family: 'goblin', ai_role: 'melee', encounters: [] }],
      freeze_date: '2026-01-01',
    }));

    const stats = bootstrap(db, tmpDir);
    expect(stats.characters).toBeGreaterThan(0);
    expect(stats.packs).toBe(2); // enemies + party
  });

  it('freeze_log entry is created with correct object_type and notes', () => {
    bootstrap(db, TFR_ROOT);
    const history = getFreezeHistory(db, 'chapter', 'ch1');
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].frozen_by).toBe('bootstrap');
    expect(history[0].notes).toContain('Frozen');
  });
});
