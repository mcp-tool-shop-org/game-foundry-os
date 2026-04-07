import type Database from 'better-sqlite3';
import type { EncounterRow, EncounterEnemyRow, BoundsCheckResult, FormationCheckResult, VariantCheckResult } from '../types.js';

export interface CreateEncounterInput {
  id: string;
  project_id: string;
  chapter: string;
  label: string;
  doctrine?: string;
  max_turns?: number;
  description?: string;
  grid_rows?: number;
  grid_cols?: number;
  route_nodes?: string[];
}

export interface CreateEnemyInput {
  encounter_id: string;
  display_name: string;
  variant_id: string;
  sprite_pack: string;
  ai_role?: string;
  grid_row: number;
  grid_col: number;
  hp?: number;
  guard?: number;
  speed?: number;
  move_range?: number;
  engine_data?: Record<string, unknown>;
  sort_order?: number;
}

export function upsertEncounter(db: Database.Database, input: CreateEncounterInput): EncounterRow {
  db.prepare(`
    INSERT INTO encounters (id, project_id, chapter, label, doctrine, max_turns, description,
      grid_rows, grid_cols, route_nodes)
    VALUES (@id, @project_id, @chapter, @label, @doctrine, @max_turns, @description,
      @grid_rows, @grid_cols, @route_nodes)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      doctrine = COALESCE(excluded.doctrine, encounters.doctrine),
      max_turns = COALESCE(excluded.max_turns, encounters.max_turns),
      description = COALESCE(excluded.description, encounters.description),
      grid_rows = excluded.grid_rows,
      grid_cols = excluded.grid_cols,
      route_nodes = COALESCE(excluded.route_nodes, encounters.route_nodes),
      updated_at = datetime('now')
  `).run({
    id: input.id,
    project_id: input.project_id,
    chapter: input.chapter,
    label: input.label,
    doctrine: input.doctrine ?? null,
    max_turns: input.max_turns ?? null,
    description: input.description ?? null,
    grid_rows: input.grid_rows ?? 3,
    grid_cols: input.grid_cols ?? 8,
    route_nodes: input.route_nodes ? JSON.stringify(input.route_nodes) : null,
  });

  return db.prepare('SELECT * FROM encounters WHERE id = ?').get(input.id) as EncounterRow;
}

export function addEnemy(db: Database.Database, input: CreateEnemyInput): EncounterEnemyRow {
  const result = db.prepare(`
    INSERT INTO encounter_enemies (encounter_id, display_name, variant_id, sprite_pack,
      ai_role, grid_row, grid_col, hp, guard, speed, move_range, engine_data, sort_order)
    VALUES (@encounter_id, @display_name, @variant_id, @sprite_pack,
      @ai_role, @grid_row, @grid_col, @hp, @guard, @speed, @move_range, @engine_data, @sort_order)
  `).run({
    encounter_id: input.encounter_id,
    display_name: input.display_name,
    variant_id: input.variant_id,
    sprite_pack: input.sprite_pack,
    ai_role: input.ai_role ?? null,
    grid_row: input.grid_row,
    grid_col: input.grid_col,
    hp: input.hp ?? null,
    guard: input.guard ?? null,
    speed: input.speed ?? null,
    move_range: input.move_range ?? null,
    engine_data: input.engine_data ? JSON.stringify(input.engine_data) : null,
    sort_order: input.sort_order ?? 0,
  });

  return db.prepare('SELECT * FROM encounter_enemies WHERE id = ?')
    .get(result.lastInsertRowid) as EncounterEnemyRow;
}

export function clearEnemies(db: Database.Database, encounterId: string): void {
  db.prepare('DELETE FROM encounter_enemies WHERE encounter_id = ?').run(encounterId);
}

export function getEncounter(db: Database.Database, id: string): EncounterRow | undefined {
  return db.prepare('SELECT * FROM encounters WHERE id = ?').get(id) as EncounterRow | undefined;
}

export function getEncounterEnemies(db: Database.Database, encounterId: string): EncounterEnemyRow[] {
  return db.prepare('SELECT * FROM encounter_enemies WHERE encounter_id = ? ORDER BY sort_order')
    .all(encounterId) as EncounterEnemyRow[];
}

export function listEncounters(db: Database.Database, filters?: {
  project_id?: string;
  chapter?: string;
}): EncounterRow[] {
  let query = 'SELECT * FROM encounters WHERE 1=1';
  const params: Record<string, string> = {};

  if (filters?.project_id) {
    query += ' AND project_id = @project_id';
    params.project_id = filters.project_id;
  }
  if (filters?.chapter) {
    query += ' AND chapter = @chapter';
    params.chapter = filters.chapter;
  }

  query += ' ORDER BY chapter, id';
  return db.prepare(query).all(params) as EncounterRow[];
}

// ─── Validation ─────────────────────────────────────────────

export function validateBounds(db: Database.Database, encounterId: string): BoundsCheckResult {
  const encounter = getEncounter(db, encounterId);
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const enemies = getEncounterEnemies(db, encounterId);
  const violations: string[] = [];

  const enemyResults = enemies.map(e => {
    const inBounds = e.grid_row >= 0 && e.grid_row < encounter.grid_rows
      && e.grid_col >= 0 && e.grid_col < encounter.grid_cols;
    if (!inBounds) {
      violations.push(
        `${e.display_name} (${e.variant_id}) at row=${e.grid_row},col=${e.grid_col} ` +
        `is outside ${encounter.grid_rows}×${encounter.grid_cols} grid`
      );
    }
    return {
      name: e.display_name,
      variant_id: e.variant_id,
      row: e.grid_row,
      col: e.grid_col,
      in_bounds: inBounds,
    };
  });

  const pass = violations.length === 0;

  // Cache result
  db.prepare(`
    UPDATE encounters SET bounds_valid = ?, last_validated_at = datetime('now') WHERE id = ?
  `).run(pass ? 1 : 0, encounterId);

  return {
    encounter_id: encounterId,
    grid: { rows: encounter.grid_rows, cols: encounter.grid_cols },
    enemies: enemyResults,
    pass,
    violations,
  };
}

export function validateFormation(db: Database.Database, encounterId: string): FormationCheckResult {
  const encounter = getEncounter(db, encounterId);
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const enemies = getEncounterEnemies(db, encounterId);
  const checks = [];

  // Check: no overlapping positions
  const positions = new Set<string>();
  const overlaps: string[] = [];
  for (const e of enemies) {
    const key = `${e.grid_row},${e.grid_col}`;
    if (positions.has(key)) {
      overlaps.push(`${e.display_name} overlaps at ${key}`);
    }
    positions.add(key);
  }
  checks.push({
    check: 'no_overlap',
    pass: overlaps.length === 0,
    detail: overlaps.length === 0 ? 'All positions unique' : overlaps.join('; '),
  });

  // Check: enemy count fits grid capacity
  const maxCapacity = encounter.grid_rows * encounter.grid_cols;
  const countOk = enemies.length <= maxCapacity;
  checks.push({
    check: 'count_legal',
    pass: countOk,
    detail: countOk
      ? `${enemies.length} enemies fits ${maxCapacity} capacity`
      : `${enemies.length} enemies exceeds ${maxCapacity} grid capacity`,
  });

  // Check: positions are distinct from each other
  checks.push({
    check: 'positions_distinct',
    pass: positions.size === enemies.length,
    detail: positions.size === enemies.length
      ? 'All enemy positions are distinct'
      : `${enemies.length - positions.size} duplicate position(s)`,
  });

  const pass = checks.every(c => c.pass);

  db.prepare(`
    UPDATE encounters SET formation_valid = ?, last_validated_at = datetime('now') WHERE id = ?
  `).run(pass ? 1 : 0, encounterId);

  return { encounter_id: encounterId, checks, pass };
}

export function validateVariants(db: Database.Database, encounterId: string): VariantCheckResult {
  const encounter = getEncounter(db, encounterId);
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const enemies = getEncounterEnemies(db, encounterId);
  const missing: string[] = [];

  const enemyResults = enemies.map(e => {
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(e.variant_id);
    const pack = db.prepare('SELECT * FROM asset_packs WHERE id = ?').get(e.sprite_pack);

    const variantExists = !!variant;
    const packExists = !!pack;

    if (!variantExists) missing.push(`variant '${e.variant_id}' for ${e.display_name}`);
    if (!packExists) missing.push(`pack '${e.sprite_pack}' for ${e.display_name}`);

    return {
      name: e.display_name,
      variant_id: e.variant_id,
      variant_exists: variantExists,
      pack_exists: packExists,
    };
  });

  const pass = missing.length === 0;

  db.prepare(`
    UPDATE encounters SET variants_valid = ?, last_validated_at = datetime('now') WHERE id = ?
  `).run(pass ? 1 : 0, encounterId);

  return { encounter_id: encounterId, enemies: enemyResults, pass, missing };
}
