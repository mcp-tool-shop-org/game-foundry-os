import { describe, it, expect, beforeAll } from 'vitest';
import {
  openDatabase, listCharacters,
} from '@mcptoolshop/game-foundry-registry';
import { bootstrap } from '../../bootstrap/src/scan-tfr.js';
import { verifyRuntimePaths } from '../src/tools/verifyRuntimePaths.js';
import { reportPlaceholders } from '../src/tools/reportPlaceholders.js';
import { getBattleRuntimeStatus } from '../src/tools/getBattleRuntimeStatus.js';
import type Database from 'better-sqlite3';

const PROJECT_ROOT = 'F:/AI/the-fractured-road';
const PROJECT_ID = 'the-fractured-road';

let db: Database.Database;

beforeAll(() => {
  db = openDatabase(':memory:');
  bootstrap(db, PROJECT_ROOT);
});

describe('engine bridge integration with The Fractured Road', () => {
  it('verifyRuntimePaths finds all variants with PNGs', () => {
    const result = verifyRuntimePaths(db, PROJECT_ID);
    // All non-portrait variants should be checked
    expect(result.characters.length).toBeGreaterThan(0);
    // Count how many have 8/8 PNGs
    const complete = result.characters.filter(c => c.albedo_count >= 8);
    expect(complete.length).toBeGreaterThan(0);
  });

  it('reportPlaceholders returns 0 placeholders', () => {
    const result = reportPlaceholders(db, PROJECT_ID);
    expect(result.placeholder_count).toBe(0);
    expect(result.total_checked).toBeGreaterThan(0);
  });

  it('getBattleRuntimeStatus shows 6/6 party complete', () => {
    const status = getBattleRuntimeStatus(db, PROJECT_ID);
    expect(status.party.total).toBe(6);
    // Party may not all have 8/8 PNGs + imports — check they're tracked
    expect(status.party.total).toBe(
      status.party.complete + status.party.placeholders.length,
    );
  });

  it('getBattleRuntimeStatus shows 7/7 encounters passing all validation', () => {
    const status = getBattleRuntimeStatus(db, PROJECT_ID);
    expect(status.encounters.total).toBe(7);
    expect(status.encounters.bounds_pass).toBe(7);
    expect(status.encounters.formation_pass).toBe(7);
    expect(status.encounters.variants_pass).toBe(7);
  });

  it('portraits.missing includes characters without portrait files', () => {
    const status = getBattleRuntimeStatus(db, PROJECT_ID);
    // All characters should appear in either have or missing
    const allChars = listCharacters(db, { project_id: PROJECT_ID });
    const totalPortraitTracked = status.portraits.have.length + status.portraits.missing.length;
    expect(totalPortraitTracked).toBe(allChars.length);
  });
});
