import { describe, it, expect, beforeAll } from 'vitest';
import {
  openDatabase,
  listCharacters,
  listPacks,
  listEncounters,
  validateBounds,
  validateFormation,
  getPack,
} from '@mcptoolshop/game-foundry-registry';
import { bootstrap } from '../src/scan-tfr.js';
import type Database from 'better-sqlite3';

const PROJECT_ROOT = 'F:/AI/the-fractured-road';

let db: Database.Database;
let stats: ReturnType<typeof bootstrap>;

beforeAll(() => {
  db = openDatabase(':memory:');
  stats = bootstrap(db, PROJECT_ROOT);
});

describe('bootstrap from The Fractured Road', () => {
  it('registers the project', () => {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get('the-fractured-road') as { id: string; display_name: string } | undefined;
    expect(project).toBeDefined();
    expect(project!.display_name).toBe('The Fractured Road');
  });

  it('registers 11 unique enemy/boss characters from manifest', () => {
    // Manifest has 12 entries but avar_armed + avar_desperate share charId 'avar'
    const enemies = listCharacters(db, { project_id: 'the-fractured-road' })
      .filter(c => c.role === 'enemy' || c.role === 'boss');
    expect(enemies.length).toBe(11);
  });

  it('registers 6 party characters', () => {
    const party = listCharacters(db, { project_id: 'the-fractured-road' })
      .filter(c => c.role === 'party');
    expect(party).toHaveLength(6);
    const names = party.map(p => p.id);
    expect(names).toContain('maren');
    expect(names).toContain('sable');
    expect(names).toContain('drift');
    expect(names).toContain('wynn');
    expect(names).toContain('vael');
    expect(names).toContain('thresh');
  });

  it('registers ch1-enemies pack with correct sprite_size and directions', () => {
    const pack = getPack(db, 'ch1-enemies');
    expect(pack).toBeDefined();
    expect(pack!.sprite_size).toBe(48);
    expect(pack!.directions).toBe(8);
    expect(pack!.pack_type).toBe('enemy');
    expect(pack!.chapter).toBe('ch1');
  });

  it('registers party pack', () => {
    const pack = getPack(db, 'party');
    expect(pack).toBeDefined();
    expect(pack!.pack_type).toBe('party');
    expect(pack!.sprite_size).toBe(48);
  });

  it('registers 7 encounters', () => {
    const encounters = listEncounters(db, { project_id: 'the-fractured-road' });
    expect(encounters).toHaveLength(7);
    expect(stats.encounters).toBe(7);
  });

  it('all 7 encounters pass bounds validation', () => {
    expect(stats.validation.bounds_pass).toBe(7);
    expect(stats.validation.bounds_fail).toBe(0);

    // Double-check by re-validating each
    const encounters = listEncounters(db, { project_id: 'the-fractured-road' });
    for (const enc of encounters) {
      const result = validateBounds(db, enc.id);
      expect(result.pass).toBe(true);
    }
  });

  it('all 7 encounters pass formation validation', () => {
    expect(stats.validation.formation_pass).toBe(7);
    expect(stats.validation.formation_fail).toBe(0);

    const encounters = listEncounters(db, { project_id: 'the-fractured-road' });
    for (const enc of encounters) {
      const result = validateFormation(db, enc.id);
      expect(result.pass).toBe(true);
    }
  });
});
