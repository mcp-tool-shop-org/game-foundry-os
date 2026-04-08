import type Database from 'better-sqlite3';
import type { DiagnosticFinding } from '@mcptoolshop/game-foundry-registry';
import {
  getSceneContractByEncounter,
  getLayersByContract,
  getSnapshotsByContract,
  listPlaytestSessions,
  listEncounters,
} from '@mcptoolshop/game-foundry-registry';
import { validateSceneContract } from './scene-contract.js';
import { validateLayerDependencies } from './ui-layers.js';

/**
 * Run battle scene diagnostics for a project.
 * Generates `battle_*` findings that route to the `presentation_integrity` quality domain.
 */
export function runBattleSceneDiagnostics(
  db: Database.Database,
  projectId: string,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];
  const encounters = listEncounters(db, { project_id: projectId });

  for (const encounter of encounters) {
    const contract = getSceneContractByEncounter(db, encounter.id);

    if (!contract) {
      findings.push({
        id: `battle_no_scene_contract_${encounter.id}`,
        severity: 'major',
        source_tool: 'battle_diagnostics',
        affected_path: encounter.id,
        message: `Encounter '${encounter.label}' has no battle scene contract`,
        repairable: true,
        repair_action: 'battle_create_scene_contract',
      });
      continue;
    }

    // Validate contract consistency
    const contractValidation = validateSceneContract(db, contract.id);
    for (const check of contractValidation.checks) {
      if (!check.pass) {
        const findingId = `battle_${check.check}_${encounter.id}`;
        findings.push({
          id: findingId,
          severity: check.check === 'board_fits_viewport' ? 'critical' : 'major',
          source_tool: 'battle_validate_scene_contract',
          affected_path: contract.id,
          message: check.detail,
          repairable: false,
          repair_action: null,
        });
      }
    }

    // Check layers configured
    const layers = getLayersByContract(db, contract.id);
    if (layers.length === 0) {
      findings.push({
        id: `battle_no_layers_${encounter.id}`,
        severity: 'major',
        source_tool: 'battle_diagnostics',
        affected_path: contract.id,
        message: `Scene contract for '${encounter.label}' has no UI layers configured`,
        repairable: true,
        repair_action: 'battle_configure_default_layers',
      });
    } else {
      // Validate layer dependencies
      const layerValidation = validateLayerDependencies(db, contract.id);
      if (!layerValidation.z_order_valid) {
        findings.push({
          id: `battle_overlay_z_conflict_${encounter.id}`,
          severity: 'major',
          source_tool: 'battle_validate_layer_dependencies',
          affected_path: contract.id,
          message: `z-order conflicts: ${layerValidation.z_order_conflicts.join('; ')}`,
          repairable: true,
          repair_action: 'battle_configure_default_layers',
        });
      }
      for (const lr of layerValidation.layers) {
        if (!lr.pass) {
          findings.push({
            id: `battle_layer_data_incomplete_${lr.layer_key}_${encounter.id}`,
            severity: 'major',
            source_tool: 'battle_validate_layer_dependencies',
            affected_path: contract.id,
            message: `${lr.layer_key} layer missing data: ${lr.missing_fields.map(f => `${f.enemy_name}.${f.field}`).join(', ')}`,
            repairable: false,
            repair_action: null,
          });
        }
      }
    }

    // Check snapshots
    const snapshots = getSnapshotsByContract(db, contract.id);
    if (snapshots.length < 5) {
      findings.push({
        id: `battle_missing_snapshots_${encounter.id}`,
        severity: 'minor',
        source_tool: 'battle_diagnostics',
        affected_path: contract.id,
        message: `Only ${snapshots.length}/5 canonical snapshots captured for '${encounter.label}'`,
        repairable: true,
        repair_action: 'battle_capture_all_snapshots',
      });
    }

    // Check playtest
    const sessions = listPlaytestSessions(db, encounter.id);
    const completed = sessions.filter(s => s.session_state === 'completed');
    if (completed.length === 0) {
      findings.push({
        id: `battle_no_playtest_${encounter.id}`,
        severity: 'minor',
        source_tool: 'battle_diagnostics',
        affected_path: encounter.id,
        message: `No completed playtest for encounter '${encounter.label}'`,
        repairable: true,
        repair_action: 'battle_start_playtest',
      });
    } else {
      const latest = completed[0];
      if (latest.quality_verdict === 'fail') {
        findings.push({
          id: `battle_playtest_failures_${encounter.id}`,
          severity: 'major',
          source_tool: 'battle_record_playtest_result',
          affected_path: encounter.id,
          message: `Latest playtest for '${encounter.label}' failed with ${latest.read_failures} read failure(s)`,
          repairable: false,
          repair_action: null,
        });
      }
    }
  }

  return findings;
}
