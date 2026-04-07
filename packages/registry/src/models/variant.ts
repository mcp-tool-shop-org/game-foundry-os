import type Database from 'better-sqlite3';
import type { VariantRow, VariantType } from '../types.js';

export interface CreateVariantInput {
  id: string;
  character_id: string;
  variant_type: VariantType;
  pack_id?: string;
  phase?: number;
  concept_dir?: string;
  directional_dir?: string;
  sheet_path?: string;
  pack_dir?: string;
}

export function upsertVariant(db: Database.Database, input: CreateVariantInput): VariantRow {
  db.prepare(`
    INSERT INTO variants (id, character_id, variant_type, pack_id, phase,
      concept_dir, directional_dir, sheet_path, pack_dir)
    VALUES (@id, @character_id, @variant_type, @pack_id, @phase,
      @concept_dir, @directional_dir, @sheet_path, @pack_dir)
    ON CONFLICT(id) DO UPDATE SET
      variant_type = excluded.variant_type,
      pack_id = COALESCE(excluded.pack_id, variants.pack_id),
      phase = COALESCE(excluded.phase, variants.phase),
      concept_dir = COALESCE(excluded.concept_dir, variants.concept_dir),
      directional_dir = COALESCE(excluded.directional_dir, variants.directional_dir),
      sheet_path = COALESCE(excluded.sheet_path, variants.sheet_path),
      pack_dir = COALESCE(excluded.pack_dir, variants.pack_dir),
      updated_at = datetime('now')
  `).run({
    id: input.id,
    character_id: input.character_id,
    variant_type: input.variant_type,
    pack_id: input.pack_id ?? null,
    phase: input.phase ?? null,
    concept_dir: input.concept_dir ?? null,
    directional_dir: input.directional_dir ?? null,
    sheet_path: input.sheet_path ?? null,
    pack_dir: input.pack_dir ?? null,
  });

  return db.prepare('SELECT * FROM variants WHERE id = ?').get(input.id) as VariantRow;
}

export function getVariant(db: Database.Database, id: string): VariantRow | undefined {
  return db.prepare('SELECT * FROM variants WHERE id = ?').get(id) as VariantRow | undefined;
}

export function listVariantsForCharacter(db: Database.Database, characterId: string): VariantRow[] {
  return db.prepare('SELECT * FROM variants WHERE character_id = ? ORDER BY variant_type, phase')
    .all(characterId) as VariantRow[];
}

export function updateVariantPresence(
  db: Database.Database,
  variantId: string,
  fields: { sheet_present?: number; pack_present?: number; directions_present?: number; content_hash?: string }
): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: variantId };

  if (fields.sheet_present !== undefined) {
    sets.push('sheet_present = @sheet_present');
    params.sheet_present = fields.sheet_present;
  }
  if (fields.pack_present !== undefined) {
    sets.push('pack_present = @pack_present');
    params.pack_present = fields.pack_present;
  }
  if (fields.directions_present !== undefined) {
    sets.push('directions_present = @directions_present');
    params.directions_present = fields.directions_present;
  }
  if (fields.content_hash !== undefined) {
    sets.push('content_hash = @content_hash');
    params.content_hash = fields.content_hash;
  }

  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");

  db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = @id`).run(params);
}
