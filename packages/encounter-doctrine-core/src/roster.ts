import type Database from 'better-sqlite3';
import type { EncounterEnemyRow } from '@mcptoolshop/game-foundry-registry';

export interface AddUnitInput {
  encounter_id: string;
  display_name: string;
  variant_id: string;
  sprite_pack: string;
  team?: string;
  role_tag?: string;
  ai_role?: string;
  grid_row: number;
  grid_col: number;
  hp?: number;
  guard?: number;
  speed?: number;
  move_range?: number;
  facing?: string;
  spawn_group?: string;
  engine_profile_json?: string;
  character_id?: string;
  engine_data?: Record<string, unknown>;
  sort_order?: number;
}

export function addUnit(db: Database.Database, input: AddUnitInput): EncounterEnemyRow {
  const result = db.prepare(`
    INSERT INTO encounter_enemies (
      encounter_id, display_name, variant_id, sprite_pack,
      team, role_tag, ai_role,
      grid_row, grid_col, hp, guard, speed, move_range,
      facing, spawn_group, engine_profile_json, character_id,
      engine_data, sort_order
    ) VALUES (
      @encounter_id, @display_name, @variant_id, @sprite_pack,
      @team, @role_tag, @ai_role,
      @grid_row, @grid_col, @hp, @guard, @speed, @move_range,
      @facing, @spawn_group, @engine_profile_json, @character_id,
      @engine_data, @sort_order
    )
  `).run({
    encounter_id: input.encounter_id,
    display_name: input.display_name,
    variant_id: input.variant_id,
    sprite_pack: input.sprite_pack,
    team: input.team ?? 'enemy',
    role_tag: input.role_tag ?? null,
    ai_role: input.ai_role ?? null,
    grid_row: input.grid_row,
    grid_col: input.grid_col,
    hp: input.hp ?? null,
    guard: input.guard ?? null,
    speed: input.speed ?? null,
    move_range: input.move_range ?? null,
    facing: input.facing ?? null,
    spawn_group: input.spawn_group ?? null,
    engine_profile_json: input.engine_profile_json ?? null,
    character_id: input.character_id ?? null,
    engine_data: input.engine_data ? JSON.stringify(input.engine_data) : null,
    sort_order: input.sort_order ?? 0,
  });

  return db.prepare('SELECT * FROM encounter_enemies WHERE id = ?')
    .get(result.lastInsertRowid) as EncounterEnemyRow;
}

export interface MoveUnitInput {
  grid_row?: number;
  grid_col?: number;
  facing?: string;
  spawn_group?: string;
}

export function moveUnit(
  db: Database.Database,
  unitId: number,
  updates: MoveUnitInput,
): EncounterEnemyRow {
  const existing = db.prepare('SELECT * FROM encounter_enemies WHERE id = ?').get(unitId) as
    | EncounterEnemyRow | undefined;
  if (!existing) throw new Error(`Unit not found: ${unitId}`);

  const sets: string[] = [];
  const params: Record<string, unknown> = { id: unitId };

  if (updates.grid_row !== undefined) {
    sets.push('grid_row = @grid_row');
    params.grid_row = updates.grid_row;
  }
  if (updates.grid_col !== undefined) {
    sets.push('grid_col = @grid_col');
    params.grid_col = updates.grid_col;
  }
  if (updates.facing !== undefined) {
    sets.push('facing = @facing');
    params.facing = updates.facing;
  }
  if (updates.spawn_group !== undefined) {
    sets.push('spawn_group = @spawn_group');
    params.spawn_group = updates.spawn_group;
  }

  if (sets.length > 0) {
    db.prepare(`UPDATE encounter_enemies SET ${sets.join(', ')} WHERE id = @id`).run(params);
  }

  return db.prepare('SELECT * FROM encounter_enemies WHERE id = ?').get(unitId) as EncounterEnemyRow;
}

export function removeUnit(db: Database.Database, unitId: number): void {
  const existing = db.prepare('SELECT * FROM encounter_enemies WHERE id = ?').get(unitId);
  if (!existing) throw new Error(`Unit not found: ${unitId}`);
  db.prepare('DELETE FROM encounter_enemies WHERE id = ?').run(unitId);
}

export function getUnits(db: Database.Database, encounterId: string): EncounterEnemyRow[] {
  return db.prepare(
    'SELECT * FROM encounter_enemies WHERE encounter_id = ? ORDER BY sort_order ASC',
  ).all(encounterId) as EncounterEnemyRow[];
}

export function getUnitCount(db: Database.Database, encounterId: string): number {
  const row = db.prepare(
    'SELECT COUNT(*) as cnt FROM encounter_enemies WHERE encounter_id = ?',
  ).get(encounterId) as { cnt: number };
  return row.cnt;
}
