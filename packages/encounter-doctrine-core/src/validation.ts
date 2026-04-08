import type Database from 'better-sqlite3';
import type { EncounterRow, EncounterEnemyRow, EncounterValidationRunRow } from '@mcptoolshop/game-foundry-registry';

export interface ValidationReport {
  encounter_id: string;
  validation_type: string;
  pass: boolean;
  details: Record<string, unknown>;
  run_id: number;
}

function writeValidationRun(
  db: Database.Database,
  encounterId: string,
  validationType: string,
  pass: boolean,
  details: Record<string, unknown>,
): number {
  const result = db.prepare(`
    INSERT INTO encounter_validation_runs (encounter_id, validation_type, result, details_json)
    VALUES (?, ?, ?, ?)
  `).run(encounterId, validationType, pass ? 'pass' : 'fail', JSON.stringify(details));
  return Number(result.lastInsertRowid);
}

/**
 * Structural validation: bounds + formation + arena sanity + team presence.
 */
export function validateStructural(db: Database.Database, encounterId: string): ValidationReport {
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId) as
    | EncounterRow | undefined;
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const enemies = db.prepare(
    'SELECT * FROM encounter_enemies WHERE encounter_id = ? ORDER BY sort_order',
  ).all(encounterId) as EncounterEnemyRow[];

  const issues: string[] = [];

  // Bounds check
  for (const e of enemies) {
    if (e.grid_row < 0 || e.grid_row >= encounter.grid_rows ||
        e.grid_col < 0 || e.grid_col >= encounter.grid_cols) {
      issues.push(`${e.display_name} at row=${e.grid_row},col=${e.grid_col} out of ${encounter.grid_rows}x${encounter.grid_cols} grid`);
    }
  }

  // Formation: no overlapping positions
  const positions = new Set<string>();
  for (const e of enemies) {
    const key = `${e.grid_row},${e.grid_col}`;
    if (positions.has(key)) {
      issues.push(`Overlap at ${key}: ${e.display_name}`);
    }
    positions.add(key);
  }

  // Arena sanity: grid must be at least 1x1
  if (encounter.grid_rows < 1 || encounter.grid_cols < 1) {
    issues.push(`Invalid arena dimensions: ${encounter.grid_rows}x${encounter.grid_cols}`);
  }

  // Team presence: must have at least one unit
  if (enemies.length === 0) {
    issues.push('Roster is empty — no units defined');
  }

  // Check capacity
  const maxCapacity = encounter.grid_rows * encounter.grid_cols;
  if (enemies.length > maxCapacity) {
    issues.push(`${enemies.length} units exceeds grid capacity of ${maxCapacity}`);
  }

  const pass = issues.length === 0;
  const details = { issues, unit_count: enemies.length, grid: { rows: encounter.grid_rows, cols: encounter.grid_cols } };

  // Update cached validation state
  db.prepare(`
    UPDATE encounters SET bounds_valid = ?, formation_valid = ?, last_validated_at = datetime('now') WHERE id = ?
  `).run(pass ? 1 : 0, pass ? 1 : 0, encounterId);

  const runId = writeValidationRun(db, encounterId, 'structural', pass, details);

  return { encounter_id: encounterId, validation_type: 'structural', pass, details, run_id: runId };
}

/**
 * Dependency validation: checks all variant_ids exist in variants table,
 * all sprite_packs exist in asset_packs table, phase2 variants exist if rules claim them.
 */
export function validateDependencies(db: Database.Database, encounterId: string): ValidationReport {
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId) as
    | EncounterRow | undefined;
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const enemies = db.prepare(
    'SELECT * FROM encounter_enemies WHERE encounter_id = ? ORDER BY sort_order',
  ).all(encounterId) as EncounterEnemyRow[];

  const issues: string[] = [];
  const missingVariants: string[] = [];
  const missingPacks: string[] = [];

  for (const e of enemies) {
    const variant = db.prepare('SELECT id FROM variants WHERE id = ?').get(e.variant_id);
    if (!variant) {
      missingVariants.push(e.variant_id);
      issues.push(`Missing variant: ${e.variant_id} for ${e.display_name}`);
    }

    const pack = db.prepare('SELECT id FROM asset_packs WHERE id = ?').get(e.sprite_pack);
    if (!pack) {
      missingPacks.push(e.sprite_pack);
      issues.push(`Missing pack: ${e.sprite_pack} for ${e.display_name}`);
    }
  }

  // Check phase2 variants from rules
  const rules = db.prepare(
    "SELECT * FROM encounter_rules WHERE encounter_id = ? AND rule_type = 'phase_transition'",
  ).all(encounterId) as Array<{ rule_payload_json: string | null }>;

  for (const rule of rules) {
    if (rule.rule_payload_json) {
      try {
        const payload = JSON.parse(rule.rule_payload_json);
        if (payload.phase2_variant_id) {
          const v = db.prepare('SELECT id FROM variants WHERE id = ?').get(payload.phase2_variant_id);
          if (!v) {
            missingVariants.push(payload.phase2_variant_id);
            issues.push(`Missing phase2 variant: ${payload.phase2_variant_id} from phase_transition rule`);
          }
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  // Update cached state
  db.prepare(`
    UPDATE encounters SET variants_valid = ?, last_validated_at = datetime('now') WHERE id = ?
  `).run(issues.length === 0 ? 1 : 0, encounterId);

  const pass = issues.length === 0;
  const details = { issues, missing_variants: missingVariants, missing_packs: missingPacks };
  const runId = writeValidationRun(db, encounterId, 'dependencies', pass, details);

  return { encounter_id: encounterId, validation_type: 'dependencies', pass, details, run_id: runId };
}

/** Get all validation runs for an encounter */
export function getValidationHistory(
  db: Database.Database,
  encounterId: string,
): EncounterValidationRunRow[] {
  return db.prepare(
    'SELECT * FROM encounter_validation_runs WHERE encounter_id = ? ORDER BY created_at ASC',
  ).all(encounterId) as EncounterValidationRunRow[];
}
