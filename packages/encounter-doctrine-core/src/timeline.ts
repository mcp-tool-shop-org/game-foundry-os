import type Database from 'better-sqlite3';
import type {
  StateEventRow,
  EncounterValidationRunRow,
  EncounterExportRow,
  EncounterSyncReceiptRow,
  EncounterRow,
} from '@mcptoolshop/game-foundry-registry';

export interface EncounterTimelineEntry {
  timestamp: string;
  type: 'state_change' | 'validation' | 'roster_change' | 'rule_change' | 'export' | 'sync';
  summary: string;
  detail: Record<string, unknown>;
}

/**
 * Merge state events, validation runs, exports, sync events into
 * a chronological timeline.
 */
export function getEncounterTimeline(
  db: Database.Database,
  encounterId: string,
): EncounterTimelineEntry[] {
  const entries: EncounterTimelineEntry[] = [];

  // State events
  const stateEvents = db.prepare(
    "SELECT * FROM state_events WHERE entity_type = 'encounter' AND entity_id = ? ORDER BY created_at ASC",
  ).all(encounterId) as StateEventRow[];

  for (const e of stateEvents) {
    entries.push({
      timestamp: e.created_at,
      type: 'state_change',
      summary: `${e.from_state ?? 'initial'} → ${e.to_state}`,
      detail: {
        from_state: e.from_state,
        to_state: e.to_state,
        reason: e.reason,
        tool_name: e.tool_name,
      },
    });
  }

  // Validation runs
  const validationRuns = db.prepare(
    'SELECT * FROM encounter_validation_runs WHERE encounter_id = ? ORDER BY created_at ASC',
  ).all(encounterId) as EncounterValidationRunRow[];

  for (const v of validationRuns) {
    entries.push({
      timestamp: v.created_at,
      type: 'validation',
      summary: `${v.validation_type}: ${v.result}`,
      detail: {
        validation_type: v.validation_type,
        result: v.result,
        details: v.details_json ? JSON.parse(v.details_json) : null,
      },
    });
  }

  // Exports
  const exports = db.prepare(
    'SELECT * FROM encounter_exports WHERE encounter_id = ? ORDER BY created_at ASC',
  ).all(encounterId) as EncounterExportRow[];

  for (const ex of exports) {
    entries.push({
      timestamp: ex.created_at,
      type: 'export',
      summary: `Exported manifest v${ex.format_version} → ${ex.manifest_path}`,
      detail: {
        export_id: ex.id,
        manifest_path: ex.manifest_path,
        content_hash: ex.content_hash,
        format_version: ex.format_version,
        is_canonical: ex.is_canonical,
      },
    });
  }

  // Sync receipts
  const syncs = db.prepare(
    'SELECT * FROM encounter_sync_receipts WHERE encounter_id = ? ORDER BY created_at ASC',
  ).all(encounterId) as EncounterSyncReceiptRow[];

  for (const s of syncs) {
    entries.push({
      timestamp: s.created_at,
      type: 'sync',
      summary: `Synced to ${s.target_path} — ${s.verification_status}`,
      detail: {
        receipt_id: s.id,
        target_path: s.target_path,
        verification_status: s.verification_status,
        receipt_hash: s.receipt_hash,
      },
    });
  }

  // Sort by timestamp
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return entries;
}

export interface ChapterMatrixEntry {
  encounter_id: string;
  label: string;
  display_name: string | null;
  production_state: string;
  encounter_type: string;
  unit_count: number;
  bounds_valid: boolean;
  formation_valid: boolean;
  variants_valid: boolean;
  has_export: boolean;
  has_sync: boolean;
}

/**
 * Returns all encounters for a chapter with their states, validation, export/sync status.
 */
export function getChapterMatrix(
  db: Database.Database,
  projectId: string,
  chapter: string,
): ChapterMatrixEntry[] {
  const encounters = db.prepare(
    'SELECT * FROM encounters WHERE project_id = ? AND chapter = ? ORDER BY id',
  ).all(projectId, chapter) as EncounterRow[];

  return encounters.map(enc => {
    const unitCount = (db.prepare(
      'SELECT COUNT(*) as cnt FROM encounter_enemies WHERE encounter_id = ?',
    ).get(enc.id) as { cnt: number }).cnt;

    const hasExport = !!(db.prepare(
      'SELECT id FROM encounter_exports WHERE encounter_id = ? AND is_canonical = 1 LIMIT 1',
    ).get(enc.id));

    const hasSync = !!(db.prepare(
      'SELECT id FROM encounter_sync_receipts WHERE encounter_id = ? LIMIT 1',
    ).get(enc.id));

    return {
      encounter_id: enc.id,
      label: enc.label,
      display_name: enc.display_name,
      production_state: enc.production_state,
      encounter_type: enc.encounter_type,
      unit_count: unitCount,
      bounds_valid: !!enc.bounds_valid,
      formation_valid: !!enc.formation_valid,
      variants_valid: !!enc.variants_valid,
      has_export: hasExport,
      has_sync: hasSync,
    };
  });
}
