import { describe, it, expect, beforeEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import { getProductionState } from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';

describe('create_variant tool', () => {
  let db: Database.Database;
  const projectId = 'proj_cv';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'Create Variant Project', '/tmp/cv');
  });

  it('creates character and variant when character does not exist', () => {
    const charId = 'char_new';
    const variantId = 'var_new';

    // Auto-create character (replicating tool logic)
    const existing = db.prepare('SELECT id FROM characters WHERE id = ?').get(charId);
    expect(existing).toBeUndefined();

    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'New Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });

    const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(charId) as any;
    expect(char).toBeDefined();
    expect(char.display_name).toBe('New Char');

    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId) as any;
    expect(variant).toBeDefined();
    expect(variant.character_id).toBe(charId);
  });

  it('creates variant under existing character', () => {
    const charId = 'char_existing';
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Existing Char' });

    const variantId = 'var_under_existing';
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });

    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId) as any;
    expect(variant).toBeDefined();
    expect(variant.character_id).toBe(charId);
  });

  it('sets production_state to draft', () => {
    const charId = 'char_draft';
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Draft Char' });
    upsertVariant(db, { id: 'var_draft', character_id: charId, variant_type: 'base' });

    const state = getProductionState(db, 'var_draft');
    expect(state).toBe('draft');
  });

  it('sets display_name and runtime_variant_name on variant', () => {
    const charId = 'char_names';
    const variantId = 'var_names';
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Names Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });

    // Replicate tool's UPDATE logic for optional fields
    db.prepare("UPDATE variants SET display_name = @display_name, runtime_variant_name = @runtime_variant_name, updated_at = datetime('now') WHERE id = @id")
      .run({ id: variantId, display_name: 'Skeleton Warrior Base', runtime_variant_name: 'base' });

    const variant = db.prepare('SELECT display_name, runtime_variant_name FROM variants WHERE id = ?').get(variantId) as any;
    expect(variant.display_name).toBe('Skeleton Warrior Base');
    expect(variant.runtime_variant_name).toBe('base');
  });

  it('returns error for missing project_id', () => {
    // Attempting to create a character under a nonexistent project should fail due to FK constraint
    expect(() => {
      upsertCharacter(db, { id: 'char_no_proj', project_id: 'nonexistent', display_name: 'Orphan' });
    }).toThrow();
  });
});
