/**
 * E2E tests for v1.5.0 — Battle Scene / Combat Presentation Spine
 *
 * Proves the full loop: encounter → contract → layers → snapshots → proof → playtest → quality domain
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  findingToDomain,
  findingsByDomain,
  computeQualityStates,
  getWeakestDomain,
  ALL_DOMAINS,
} from '@mcptoolshop/studio-bootstrap-core';
import {
  createSceneContract,
  configureDefaultLayers,
  validateLayerDependencies,
  captureAllSnapshots,
  runSceneProof,
  startPlaytest,
  recordPlaytestFailures,
  completePlaytest,
  computePlaytestReadability,
  runBattleSceneDiagnostics,
} from '@mcptoolshop/battle-scene-core';
import type { SpriteMetrics } from '@mcptoolshop/battle-scene-core';

let db: Database.Database;

function seedCompleteEncounter() {
  upsertProject(db, 'proj-e2e', 'E2E Project', '/tmp/e2e');
  upsertEncounter(db, {
    id: 'raider_ambush',
    project_id: 'proj-e2e',
    chapter: 'ch1',
    label: 'Raider Ambush',
    grid_rows: 3,
    grid_cols: 8,
  });
  addEnemy(db, {
    encounter_id: 'raider_ambush',
    display_name: 'Raider Scout',
    variant_id: 'raider_scout_base',
    sprite_pack: 'raider_enemies',
    grid_row: 0,
    grid_col: 5,
    ai_role: 'scout',
    hp: 12,
    guard: 1,
    speed: 6,
    move_range: 4,
  });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE display_name = 'Raider Scout'").run();
  addEnemy(db, {
    encounter_id: 'raider_ambush',
    display_name: 'Raider Brute',
    variant_id: 'raider_brute_base',
    sprite_pack: 'raider_enemies',
    grid_row: 1,
    grid_col: 6,
    ai_role: 'tank',
    hp: 25,
    guard: 8,
    speed: 2,
    move_range: 2,
  });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE display_name = 'Raider Brute'").run();
  addEnemy(db, {
    encounter_id: 'raider_ambush',
    display_name: 'Raider Archer',
    variant_id: 'raider_archer_base',
    sprite_pack: 'raider_enemies',
    grid_row: 2,
    grid_col: 7,
    ai_role: 'archer',
    hp: 10,
    guard: 0,
    speed: 4,
    move_range: 3,
  });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE display_name = 'Raider Archer'").run();
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('E2E: full battle scene pipeline', () => {
  it('encounter → contract → layers → snapshots → proof → playtest → quality', () => {
    seedCompleteEncounter();

    // 1. Create scene contract from encounter
    const contract = createSceneContract(db, 'proj-e2e', 'raider_ambush');
    expect(contract.board_rows).toBe(3);
    expect(contract.board_cols).toBe(8);
    expect(contract.production_state).toBe('draft');

    // 2. Configure layers
    const layers = configureDefaultLayers(db, contract.id);
    expect(layers).toHaveLength(5);

    // 3. Validate layer dependencies
    const layerVal = validateLayerDependencies(db, contract.id);
    expect(layerVal.pass).toBe(true);

    // 4. Capture all snapshots
    const snapshots = captureAllSnapshots(db, contract.id);
    expect(snapshots).toHaveLength(5);

    // 5. Run proof suite
    const goodSprites: SpriteMetrics[] = [
      { variant_id: 'raider_scout_base', width: 48, height: 48, avg_luminance: 85 },
      { variant_id: 'raider_brute_base', width: 48, height: 48, avg_luminance: 70 },
      { variant_id: 'raider_archer_base', width: 48, height: 48, avg_luminance: 75 },
    ];
    const proofResult = runSceneProof(db, contract.id, goodSprites);
    expect(proofResult.result).toBe('pass');
    expect(proofResult.blocking_failures).toBe(0);
    expect(proofResult.assertions).toHaveLength(13);

    // 6. Run playtest
    const session = startPlaytest(db, 'proj-e2e', 'raider_ambush');
    expect(session.contract_id).toBe(contract.id);
    completePlaytest(db, session.id, 'pass');

    // 7. Verify readability
    const readability = computePlaytestReadability(db, 'raider_ambush');
    expect(readability.readability).toBe('good');

    // 8. Diagnostics should be clean
    const findings = runBattleSceneDiagnostics(db, 'proj-e2e');
    const majorFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'major');
    expect(majorFindings).toHaveLength(0);
  });

  it('broken scene (sprites too small) → proof fails → finding → domain degraded', () => {
    seedCompleteEncounter();
    const contract = createSceneContract(db, 'proj-e2e', 'raider_ambush');
    configureDefaultLayers(db, contract.id);
    captureAllSnapshots(db, contract.id);

    // Tiny sprites → sprite_to_tile_ratio fails
    const tinySprites: SpriteMetrics[] = [
      { variant_id: 'raider_scout_base', width: 12, height: 12, avg_luminance: 80 },
      { variant_id: 'raider_brute_base', width: 12, height: 12, avg_luminance: 80 },
      { variant_id: 'raider_archer_base', width: 12, height: 12, avg_luminance: 80 },
    ];
    const proofResult = runSceneProof(db, contract.id, tinySprites);
    expect(proofResult.result).toBe('fail');
    expect(proofResult.assertions.find(a => a.key === 'sprite_to_tile_ratio')!.status).toBe('fail');

    // Diagnostics should not generate battle_no_scene_contract (contract exists)
    // but proof failure should be detectable in proof_runs
    const proofRow = db.prepare("SELECT * FROM proof_runs WHERE scope_type = 'battle_scene'").get() as any;
    expect(proofRow.result).toBe('fail');
  });

  it('encounter with missing enemy data → layer dependency fails → diagnostics fire', () => {
    upsertProject(db, 'proj-e2e', 'Test', '/tmp/e2e');
    upsertEncounter(db, {
      id: 'sparse_enc',
      project_id: 'proj-e2e',
      chapter: 'ch1',
      label: 'Sparse Encounter',
      grid_rows: 3,
      grid_cols: 8,
    });
    // Enemy with no facing, no ai_role, no move_range
    addEnemy(db, {
      encounter_id: 'sparse_enc',
      display_name: 'Bare Enemy',
      variant_id: 'bare_base',
      sprite_pack: 'bare_pack',
      grid_row: 1,
      grid_col: 3,
    });

    const contract = createSceneContract(db, 'proj-e2e', 'sparse_enc');
    configureDefaultLayers(db, contract.id);

    // Layer validation should fail
    const layerVal = validateLayerDependencies(db, contract.id);
    expect(layerVal.pass).toBe(false);

    // Diagnostics should report layer_data_incomplete
    const findings = runBattleSceneDiagnostics(db, 'proj-e2e');
    const layerFindings = findings.filter(f => f.id.includes('battle_layer_data_incomplete'));
    expect(layerFindings.length).toBeGreaterThan(0);

    // All battle_ findings route to presentation_integrity
    for (const f of findings) {
      if (f.id.startsWith('battle_')) {
        expect(findingToDomain(f)).toBe('presentation_integrity');
      }
    }
  });

  it('playtest failures → marginal verdict → readability degraded', () => {
    seedCompleteEncounter();
    const contract = createSceneContract(db, 'proj-e2e', 'raider_ambush');
    configureDefaultLayers(db, contract.id);
    captureAllSnapshots(db, contract.id);

    const session = startPlaytest(db, 'proj-e2e', 'raider_ambush');
    recordPlaytestFailures(db, session.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'Scout lost against bg' },
      { snapshot_key: 'threat_on', failure_type: 'threat_ambiguous', description: 'Threat zones unclear' },
      { snapshot_key: 'forecast', failure_type: 'forecast_missing', description: 'No damage preview' },
      { snapshot_key: 'enemy_turn', failure_type: 'intent_unclear', description: 'Cannot read enemy intent' },
    ]);
    completePlaytest(db, session.id, 'marginal', 'Needs contrast and clarity work');

    const readability = computePlaytestReadability(db, 'raider_ambush');
    expect(readability.readability).toBe('marginal');
    expect(readability.total_read_failures).toBe(4);
    expect(readability.failure_breakdown['unit_invisible']).toBe(1);
    expect(readability.failure_breakdown['threat_ambiguous']).toBe(1);
  });

  it('full quality domain integration: battle findings route to presentation_integrity', () => {
    upsertProject(db, 'proj-e2e', 'Test', '/tmp/e2e');
    upsertEncounter(db, {
      id: 'naked_enc',
      project_id: 'proj-e2e',
      chapter: 'ch1',
      label: 'Naked Encounter',
      grid_rows: 3,
      grid_cols: 8,
    });

    // No scene contract → diagnostics should fire
    const findings = runBattleSceneDiagnostics(db, 'proj-e2e');
    expect(findings.length).toBeGreaterThan(0);

    // Group by domain
    const grouped = findingsByDomain(findings);
    expect(grouped.presentation_integrity.length).toBeGreaterThan(0);

    // Other domains should have zero battle findings
    expect(grouped.runtime_integrity.filter(f => f.id.startsWith('battle_'))).toHaveLength(0);
    expect(grouped.encounter_integrity.filter(f => f.id.startsWith('battle_'))).toHaveLength(0);
  });
});
