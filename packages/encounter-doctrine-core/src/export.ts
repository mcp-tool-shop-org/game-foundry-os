import type Database from 'better-sqlite3';
import type { EncounterRow, EncounterEnemyRow, EncounterExportRow, EncounterRuleRow } from '@mcptoolshop/game-foundry-registry';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ExportResult {
  export_id: string;
  encounter_id: string;
  manifest_path: string;
  content_hash: string;
  format_version: string;
}

/**
 * Export encounter manifest JSON. Verifies validations passed.
 * Writes file, registers encounter_exports row.
 */
export function exportManifest(
  db: Database.Database,
  encounterId: string,
  projectRoot: string,
  targetPath: string,
  formatVersion?: string,
): ExportResult {
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId) as
    | EncounterRow | undefined;
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  // Verify validations
  if (!encounter.bounds_valid || !encounter.formation_valid) {
    throw new Error(`Structural validation not passed for ${encounterId}`);
  }
  if (!encounter.variants_valid) {
    throw new Error(`Dependency validation not passed for ${encounterId}`);
  }

  const enemies = db.prepare(
    'SELECT * FROM encounter_enemies WHERE encounter_id = ? ORDER BY sort_order',
  ).all(encounterId) as EncounterEnemyRow[];

  const rules = db.prepare(
    'SELECT * FROM encounter_rules WHERE encounter_id = ? ORDER BY created_at',
  ).all(encounterId) as EncounterRuleRow[];

  const fv = formatVersion ?? '1.0';

  const manifest = {
    format_version: fv,
    encounter_id: encounter.id,
    project_id: encounter.project_id,
    chapter: encounter.chapter,
    label: encounter.label,
    display_name: encounter.display_name,
    encounter_type: encounter.encounter_type,
    doctrine: encounter.doctrine,
    intent_summary: encounter.intent_summary,
    max_turns: encounter.max_turns,
    grid: { rows: encounter.grid_rows, cols: encounter.grid_cols },
    route_tag: encounter.route_tag,
    route_nodes: encounter.route_nodes ? JSON.parse(encounter.route_nodes) : null,
    enemies: enemies.map(e => ({
      display_name: e.display_name,
      variant_id: e.variant_id,
      sprite_pack: e.sprite_pack,
      team: e.team,
      role_tag: e.role_tag,
      ai_role: e.ai_role,
      grid_position: { row: e.grid_row, col: e.grid_col },
      facing: e.facing,
      spawn_group: e.spawn_group,
      hp: e.hp,
      guard: e.guard,
      speed: e.speed,
      move_range: e.move_range,
      engine_profile: e.engine_profile_json ? JSON.parse(e.engine_profile_json) : null,
      engine_data: e.engine_data ? JSON.parse(e.engine_data) : null,
      character_id: e.character_id,
    })),
    rules: rules.map(r => ({
      rule_type: r.rule_type,
      rule_key: r.rule_key,
      rule_payload: r.rule_payload_json ? JSON.parse(r.rule_payload_json) : null,
    })),
    exported_at: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(manifest, null, 2);
  const contentHash = createHash('sha256').update(jsonStr).digest('hex').slice(0, 16);

  // Write file
  const resolvedPath = path.resolve(projectRoot, targetPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolvedPath, jsonStr, 'utf-8');

  // Register export
  const exportId = randomUUID();
  db.prepare(`
    INSERT INTO encounter_exports (id, encounter_id, project_id, manifest_path, content_hash, format_version, export_payload_json, is_canonical)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(exportId, encounterId, encounter.project_id, resolvedPath, contentHash, fv, jsonStr);

  // Mark previous exports as non-canonical
  db.prepare(`
    UPDATE encounter_exports SET is_canonical = 0
    WHERE encounter_id = ? AND id != ?
  `).run(encounterId, exportId);

  return {
    export_id: exportId,
    encounter_id: encounterId,
    manifest_path: resolvedPath,
    content_hash: contentHash,
    format_version: fv,
  };
}

/** Get all exports for an encounter */
export function getExports(db: Database.Database, encounterId: string): EncounterExportRow[] {
  return db.prepare(
    'SELECT * FROM encounter_exports WHERE encounter_id = ? ORDER BY created_at ASC',
  ).all(encounterId) as EncounterExportRow[];
}

/** Get the latest canonical export */
export function getCanonicalExport(
  db: Database.Database,
  encounterId: string,
): EncounterExportRow | undefined {
  return db.prepare(
    'SELECT * FROM encounter_exports WHERE encounter_id = ? AND is_canonical = 1 ORDER BY created_at DESC LIMIT 1',
  ).get(encounterId) as EncounterExportRow | undefined;
}
