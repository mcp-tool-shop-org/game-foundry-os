import type Database from 'better-sqlite3';
import type { LockedPickRow, PickType } from '@mcptoolshop/game-foundry-registry';

export interface LockPickInput {
  variant_id: string;
  pick_type: PickType;
  direction?: string;
  candidate_name?: string;
  candidate_index?: number;
  locked_artifact_id?: string;
  notes?: string;
}

export function lockPick(db: Database.Database, input: LockPickInput): LockedPickRow {
  const id = `pick_${input.variant_id}_${input.pick_type}_${input.direction ?? 'main'}_${Date.now().toString(36)}`;

  // Upsert: if a pick exists for this variant+type+direction, replace it
  const existing = db.prepare(
    'SELECT id FROM locked_picks WHERE variant_id = ? AND pick_type = ? AND direction IS ?',
  ).get(input.variant_id, input.pick_type, input.direction ?? null) as { id: string } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE locked_picks SET candidate_name = ?, candidate_index = ?, locked_artifact_id = ?, notes = ?
      WHERE id = ?
    `).run(
      input.candidate_name ?? null,
      input.candidate_index ?? null,
      input.locked_artifact_id ?? null,
      input.notes ?? null,
      existing.id,
    );
    return db.prepare('SELECT * FROM locked_picks WHERE id = ?').get(existing.id) as LockedPickRow;
  }

  db.prepare(`
    INSERT INTO locked_picks (id, variant_id, pick_type, direction, candidate_name, candidate_index, locked_artifact_id, notes)
    VALUES (@id, @variant_id, @pick_type, @direction, @candidate_name, @candidate_index, @locked_artifact_id, @notes)
  `).run({
    id,
    variant_id: input.variant_id,
    pick_type: input.pick_type,
    direction: input.direction ?? null,
    candidate_name: input.candidate_name ?? null,
    candidate_index: input.candidate_index ?? null,
    locked_artifact_id: input.locked_artifact_id ?? null,
    notes: input.notes ?? null,
  });

  return db.prepare('SELECT * FROM locked_picks WHERE id = ?').get(id) as LockedPickRow;
}

export function getLockedPicks(db: Database.Database, variantId: string, pickType?: PickType): LockedPickRow[] {
  if (pickType) {
    return db.prepare('SELECT * FROM locked_picks WHERE variant_id = ? AND pick_type = ? ORDER BY direction')
      .all(variantId, pickType) as LockedPickRow[];
  }
  return db.prepare('SELECT * FROM locked_picks WHERE variant_id = ? ORDER BY pick_type, direction')
    .all(variantId) as LockedPickRow[];
}

/** Check if all required directional picks exist (5 directions) */
export function hasAllDirectionalLocks(db: Database.Database, variantId: string): boolean {
  const required = ['front', 'front_34', 'side', 'back_34', 'back'];
  const picks = getLockedPicks(db, variantId, 'directional');
  const locked = new Set(picks.map(p => p.direction));
  return required.every(d => locked.has(d));
}
