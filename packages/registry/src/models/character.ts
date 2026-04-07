import type Database from 'better-sqlite3';
import type { CharacterRow, CharacterStatus, ProductionState, VariantRow } from '../types.js';

export interface CreateCharacterInput {
  id: string;
  project_id: string;
  display_name: string;
  role?: string;
  family?: string;
  faction?: string;
  ai_role?: string;
  chapter_primary?: string;
}

export function upsertCharacter(db: Database.Database, input: CreateCharacterInput): CharacterRow {
  db.prepare(`
    INSERT INTO characters (id, project_id, display_name, role, family, faction, ai_role, chapter_primary)
    VALUES (@id, @project_id, @display_name, @role, @family, @faction, @ai_role, @chapter_primary)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      role = COALESCE(excluded.role, characters.role),
      family = COALESCE(excluded.family, characters.family),
      faction = COALESCE(excluded.faction, characters.faction),
      ai_role = COALESCE(excluded.ai_role, characters.ai_role),
      chapter_primary = COALESCE(excluded.chapter_primary, characters.chapter_primary),
      updated_at = datetime('now')
  `).run({
    id: input.id,
    project_id: input.project_id,
    display_name: input.display_name,
    role: input.role ?? null,
    family: input.family ?? null,
    faction: input.faction ?? null,
    ai_role: input.ai_role ?? null,
    chapter_primary: input.chapter_primary ?? null,
  });

  return db.prepare('SELECT * FROM characters WHERE id = ?').get(input.id) as CharacterRow;
}

export function getCharacter(db: Database.Database, id: string): CharacterRow | undefined {
  return db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as CharacterRow | undefined;
}

export function listCharacters(db: Database.Database, filters?: {
  project_id?: string;
  family?: string;
  role?: string;
  status_filter?: string;
}): CharacterRow[] {
  let query = 'SELECT * FROM characters WHERE 1=1';
  const params: Record<string, string> = {};

  if (filters?.project_id) {
    query += ' AND project_id = @project_id';
    params.project_id = filters.project_id;
  }
  if (filters?.family) {
    query += ' AND family = @family';
    params.family = filters.family;
  }
  if (filters?.role) {
    query += ' AND role = @role';
    params.role = filters.role;
  }
  if (filters?.status_filter) {
    query += ` AND freeze_status = @status_filter`;
    params.status_filter = filters.status_filter;
  }

  query += ' ORDER BY family, display_name';
  return db.prepare(query).all(params) as CharacterRow[];
}

export function setProductionState(
  db: Database.Database,
  characterId: string,
  field: string,
  value: ProductionState
): { old_value: string; new_value: string } {
  const validFields = [
    'concept_status', 'directional_status', 'sheet_status',
    'pack_status', 'portrait_status', 'integration_status', 'freeze_status',
  ];
  if (!validFields.includes(field)) {
    throw new Error(`Invalid production state field: ${field}. Valid: ${validFields.join(', ')}`);
  }

  const current = getCharacter(db, characterId);
  if (!current) throw new Error(`Character not found: ${characterId}`);

  const oldValue = (current as unknown as Record<string, unknown>)[field] as string;

  db.prepare(`UPDATE characters SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(value, characterId);

  return { old_value: oldValue, new_value: value };
}

export function getCharacterStatus(db: Database.Database, characterId: string): CharacterStatus | undefined {
  const character = getCharacter(db, characterId);
  if (!character) return undefined;

  const variants = db.prepare('SELECT * FROM variants WHERE character_id = ?')
    .all(characterId) as VariantRow[];

  const nextStep = deriveNextStep(character, variants);

  return { ...character, variants, next_step: nextStep };
}

function deriveNextStep(c: CharacterRow, variants: VariantRow[]): string {
  if (c.freeze_status === 'frozen') return 'Frozen — no action needed';
  if (c.concept_status === 'none') return 'Generate concept batch';
  if (c.concept_status === 'in_progress') return 'Lock concept pick';
  if (c.directional_status === 'none') return 'Generate directional batch';
  if (c.directional_status === 'in_progress') return 'Lock directional picks';
  if (c.sheet_status === 'none') return 'Assemble 8-dir sheet';
  if (c.pack_status === 'none') return 'Slice pack from sheet';
  if (c.portrait_status === 'none') return 'Generate portraits';
  if (c.integration_status === 'none') return 'Integrate into engine';

  const unprovedVariants = variants.filter(v => v.proof_state !== 'passed');
  if (unprovedVariants.length > 0) return `Prove ${unprovedVariants.length} variant(s)`;

  return 'Ready to freeze';
}
