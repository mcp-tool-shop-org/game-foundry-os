import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase } from '../src/db.js';
import { upsertProject } from '../src/models/project.js';
import { upsertPack, listPacks, updatePackCounts, getPack } from '../src/models/pack.js';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'tfr', 'The Fractured Road', '/tmp');
  upsertPack(db, { id: 'pack-a', project_id: 'tfr', pack_type: 'enemy', root_path: '/a', chapter: 'ch1' });
  upsertPack(db, { id: 'pack-b', project_id: 'tfr', pack_type: 'party', root_path: '/b', chapter: 'ch2' });
});

describe('pack model', () => {
  it('listPacks returns all packs for a project', () => {
    const packs = listPacks(db, 'tfr');
    expect(packs).toHaveLength(2);
    const ids = packs.map(p => p.id);
    expect(ids).toContain('pack-a');
    expect(ids).toContain('pack-b');
  });

  it('listPacks with no projectId returns all packs', () => {
    upsertProject(db, 'other', 'Other Project', '/other');
    upsertPack(db, { id: 'pack-c', project_id: 'other', pack_type: 'npc', root_path: '/c' });
    const packs = listPacks(db);
    expect(packs).toHaveLength(3);
  });

  it('updatePackCounts updates member_count and complete_members', () => {
    updatePackCounts(db, 'pack-a', 12, 8);
    const pack = getPack(db, 'pack-a');
    expect(pack?.member_count).toBe(12);
    expect(pack?.complete_members).toBe(8);
  });

  it('updatePackCounts preserves other fields', () => {
    updatePackCounts(db, 'pack-a', 5, 3);
    const pack = getPack(db, 'pack-a');
    expect(pack?.pack_type).toBe('enemy');
    expect(pack?.root_path).toBe('/a');
    expect(pack?.chapter).toBe('ch1');
    expect(pack?.member_count).toBe(5);
  });
});
