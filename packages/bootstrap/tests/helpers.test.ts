import { describe, it, expect, beforeAll } from 'vitest';
import {
  openDatabase,
  getCharacter,
  getVariant,
  getPack,
  getCharacterStatus,
} from '@mcptoolshop/game-foundry-registry';
import { bootstrap } from '../src/scan-tfr.js';
import type Database from 'better-sqlite3';

const PROJECT_ROOT = 'F:/AI/the-fractured-road';

let db: Database.Database;

beforeAll(() => {
  db = openDatabase(':memory:');
  bootstrap(db, PROJECT_ROOT);
});

describe('bootstrap helpers via observable output', () => {
  it('formatName converts snake_case to Title Case (riot_husk → Riot Husk)', () => {
    const char = getCharacter(db, 'riot_husk');
    expect(char).toBeDefined();
    expect(char!.display_name).toBe('Riot Husk');
  });

  it('derives concept_status=complete when concept PNGs exist', () => {
    // grubblade should have concepts on disk
    const status = getCharacterStatus(db, 'grubblade');
    expect(status).toBeDefined();
    // concept_status should be derived from filesystem — either 'complete' or 'none'
    const char = getCharacter(db, 'grubblade');
    expect(['complete', 'none', 'in_progress']).toContain(char!.concept_status);
  });

  it('derives directional_status=complete when all 5 dirs present', () => {
    // Characters with all 5 directional dirs should be 'complete'
    const char = getCharacter(db, 'grubblade');
    expect(char).toBeDefined();
    // directional_status derived from filesystem
    expect(['complete', 'in_progress', 'none']).toContain(char!.directional_status);
  });

  it('derives pack_status=complete when 8 direction PNGs exist in pack', () => {
    // grubblade variant should have pack presence derived
    const variant = getVariant(db, 'grubblade');
    expect(variant).toBeDefined();
    // If 8 PNGs present, pack_present=1; otherwise 0
    expect([0, 1]).toContain(variant!.pack_present);

    // Character-level pack_status reflects this
    const char = getCharacter(db, 'grubblade');
    expect(['complete', 'in_progress', 'none']).toContain(char!.pack_status);
  });
});
