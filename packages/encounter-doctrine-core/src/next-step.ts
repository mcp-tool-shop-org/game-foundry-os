import type Database from 'better-sqlite3';
import type {
  EncounterRow,
  EncounterProductionState,
  EncounterNextStepResult,
  EncounterExportRow,
  EncounterSyncReceiptRow,
} from '@mcptoolshop/game-foundry-registry';

/**
 * Determine the next action for an encounter based on its current state.
 */
export function getEncounterNextStep(
  db: Database.Database,
  encounterId: string,
): EncounterNextStepResult {
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId) as
    | EncounterRow | undefined;
  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const unitCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM encounter_enemies WHERE encounter_id = ?',
  ).get(encounterId) as { cnt: number }).cnt;

  const ruleCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM encounter_rules WHERE encounter_id = ?',
  ).get(encounterId) as { cnt: number }).cnt;

  const latestExport = db.prepare(
    'SELECT * FROM encounter_exports WHERE encounter_id = ? AND is_canonical = 1 ORDER BY created_at DESC LIMIT 1',
  ).get(encounterId) as EncounterExportRow | undefined;

  const latestSync = db.prepare(
    'SELECT * FROM encounter_sync_receipts WHERE encounter_id = ? ORDER BY created_at DESC LIMIT 1',
  ).get(encounterId) as EncounterSyncReceiptRow | undefined;

  const missingValidations: string[] = [];
  if (!encounter.bounds_valid) missingValidations.push('bounds');
  if (!encounter.formation_valid) missingValidations.push('formation');
  if (!encounter.variants_valid) missingValidations.push('variants');

  const missingDependencies: string[] = [];
  // Check for missing variant/pack refs
  const enemies = db.prepare(
    'SELECT variant_id, sprite_pack, display_name FROM encounter_enemies WHERE encounter_id = ?',
  ).all(encounterId) as Array<{ variant_id: string; sprite_pack: string; display_name: string }>;

  for (const e of enemies) {
    const v = db.prepare('SELECT id FROM variants WHERE id = ?').get(e.variant_id);
    if (!v) missingDependencies.push(`variant:${e.variant_id}`);
    const p = db.prepare('SELECT id FROM asset_packs WHERE id = ?').get(e.sprite_pack);
    if (!p) missingDependencies.push(`pack:${e.sprite_pack}`);
  }

  const exportStatus = latestExport ? 'exported' : 'not_exported';
  const syncStatus = latestSync ? latestSync.verification_status : 'not_synced';

  const blockers: string[] = [];
  let nextAction: string;

  const state = encounter.production_state;

  switch (state) {
    case 'draft':
      nextAction = 'define_intent';
      break;
    case 'intent_defined':
      nextAction = unitCount > 0 ? 'advance_to_roster_defined' : 'add_units';
      if (unitCount === 0) blockers.push('No units in roster');
      break;
    case 'roster_defined':
      nextAction = 'define_formation';
      break;
    case 'formation_defined':
      nextAction = ruleCount > 0 ? 'validate_structural' : 'attach_rules_or_validate_structural';
      break;
    case 'rules_defined':
      nextAction = 'validate_structural';
      break;
    case 'validated_structural':
      if (missingDependencies.length > 0) {
        nextAction = 'resolve_dependencies';
        blockers.push(...missingDependencies.map(d => `Missing ${d}`));
      } else {
        nextAction = 'validate_dependencies';
      }
      break;
    case 'dependencies_resolved':
      nextAction = 'export_manifest';
      break;
    case 'manifest_exported':
      nextAction = 'sync_to_engine';
      break;
    case 'engine_synced':
      nextAction = 'verify_runtime';
      break;
    case 'runtime_verified':
      nextAction = 'prove';
      break;
    case 'proved':
      nextAction = 'freeze';
      break;
    case 'frozen':
      nextAction = 'none — encounter is frozen';
      break;
    default:
      nextAction = 'unknown_state';
  }

  return {
    encounter_id: encounterId,
    production_state: state,
    runtime_sync_state: encounter.runtime_sync_state,
    unit_count: unitCount,
    missing_validations: missingValidations,
    missing_dependencies: missingDependencies,
    export_status: exportStatus,
    sync_status: syncStatus,
    next_action: nextAction,
    blockers,
  };
}
