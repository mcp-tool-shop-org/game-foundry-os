import type Database from 'better-sqlite3';
import type { TimelineEntry, StateEventRow, FoundryBatchRow, LockedPickRow, ArtifactRow } from '@mcptoolshop/game-foundry-registry';

/** Get the full production timeline for a variant */
export function getVariantTimeline(db: Database.Database, variantId: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  // State events
  const events = db.prepare(
    'SELECT * FROM state_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at',
  ).all('variant', variantId) as StateEventRow[];

  for (const e of events) {
    entries.push({
      timestamp: e.created_at,
      type: 'state_change',
      summary: `${e.from_state ?? 'init'} → ${e.to_state}${e.reason ? ` (${e.reason})` : ''}`,
      detail: { from: e.from_state, to: e.to_state, reason: e.reason, tool: e.tool_name },
    });
  }

  // Batches
  const batches = db.prepare(
    'SELECT * FROM foundry_batches WHERE variant_id = ? ORDER BY created_at',
  ).all(variantId) as FoundryBatchRow[];

  for (const b of batches) {
    entries.push({
      timestamp: b.created_at,
      type: 'batch',
      summary: `${b.batch_type} batch${b.direction ? ` (${b.direction})` : ''}: ${b.candidate_count} candidates [${b.status}]`,
      detail: { batch_id: b.id, type: b.batch_type, direction: b.direction, model: b.source_model, status: b.status },
    });
  }

  // Locked picks
  const picks = db.prepare(
    'SELECT * FROM locked_picks WHERE variant_id = ? ORDER BY created_at',
  ).all(variantId) as LockedPickRow[];

  for (const p of picks) {
    entries.push({
      timestamp: p.created_at,
      type: 'pick',
      summary: `Locked ${p.pick_type}${p.direction ? ` ${p.direction}` : ''}: ${p.candidate_name ?? `#${p.candidate_index}`}`,
      detail: { pick_id: p.id, type: p.pick_type, direction: p.direction, candidate: p.candidate_name, index: p.candidate_index },
    });
  }

  // Key artifacts (canonical only)
  const artifacts = db.prepare(
    'SELECT * FROM artifacts WHERE variant_id = ? AND is_canonical = 1 ORDER BY created_at',
  ).all(variantId) as ArtifactRow[];

  for (const a of artifacts) {
    entries.push({
      timestamp: a.created_at,
      type: 'artifact',
      summary: `${a.artifact_type}${a.direction ? ` (${a.direction})` : ''}: ${a.path}`,
      detail: { artifact_id: a.id, type: a.artifact_type, direction: a.direction, path: a.path, hash: a.content_hash },
    });
  }

  // Sort by timestamp
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return entries;
}

/** Get merged timeline across all variants of a character */
export function getCharacterTimeline(db: Database.Database, characterId: string): TimelineEntry[] {
  const variants = db.prepare('SELECT id FROM variants WHERE character_id = ?')
    .all(characterId) as { id: string }[];

  const allEntries: TimelineEntry[] = [];
  for (const v of variants) {
    const vEntries = getVariantTimeline(db, v.id);
    for (const entry of vEntries) {
      // Tag each entry with variant context
      entry.detail.variant_id = v.id;
      allEntries.push(entry);
    }
  }

  allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return allEntries;
}
