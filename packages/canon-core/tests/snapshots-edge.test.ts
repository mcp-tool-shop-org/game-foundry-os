import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
} from '@mcptoolshop/game-foundry-registry';
import {
  createSnapshot,
  compareSnapshots,
} from '@mcptoolshop/canon-core';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
});

describe('snapshot edge cases', () => {
  it('compareSnapshots identifies added frontmatter keys', () => {
    const s1 = createSnapshot(db, 'test', 'char_test', 'hash1', { title: 'V1' });
    const s2 = createSnapshot(db, 'test', 'char_test', 'hash2', { title: 'V1', faction: 'undead', role: 'enemy' });

    const diff = compareSnapshots(db, s1.id, s2.id);
    expect(diff).not.toBeNull();
    expect(diff!.frontmatter_diff.added_keys).toContain('faction');
    expect(diff!.frontmatter_diff.added_keys).toContain('role');
    expect(diff!.frontmatter_diff.removed_keys).toHaveLength(0);
    expect(diff!.frontmatter_diff.changed_keys).toHaveLength(0);
  });

  it('compareSnapshots identifies removed frontmatter keys', () => {
    const s1 = createSnapshot(db, 'test', 'char_test', 'hash1', { title: 'V1', faction: 'undead', role: 'enemy' });
    const s2 = createSnapshot(db, 'test', 'char_test', 'hash2', { title: 'V1' });

    const diff = compareSnapshots(db, s1.id, s2.id);
    expect(diff).not.toBeNull();
    expect(diff!.frontmatter_diff.removed_keys).toContain('faction');
    expect(diff!.frontmatter_diff.removed_keys).toContain('role');
    expect(diff!.frontmatter_diff.added_keys).toHaveLength(0);
  });

  it('compareSnapshots identifies changed values', () => {
    const s1 = createSnapshot(db, 'test', 'char_test', 'hash1', { title: 'Skeleton', hp: 100, tags: ['melee'] });
    const s2 = createSnapshot(db, 'test', 'char_test', 'hash2', { title: 'Skeleton Warrior', hp: 150, tags: ['melee', 'undead'] });

    const diff = compareSnapshots(db, s1.id, s2.id);
    expect(diff).not.toBeNull();
    expect(diff!.frontmatter_diff.changed_keys).toContain('title');
    expect(diff!.frontmatter_diff.changed_keys).toContain('hp');
    expect(diff!.frontmatter_diff.changed_keys).toContain('tags');
    expect(diff!.hashes_match).toBe(false);
    expect(diff!.body_changed).toBe(true);
  });
});
