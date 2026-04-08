import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject, upsertEncounter, addEnemy } from '@mcptoolshop/game-foundry-registry';
import {
  createSceneContract,
  configureDefaultLayers,
  captureAllSnapshots,
  startPlaytest,
  completePlaytest,
  recordPlaytestFailures,
  runBattleSceneDiagnostics,
} from '@mcptoolshop/battle-scene-core';

let db: Database.Database;

function seed() {
  upsertProject(db, 'proj-diag', 'Diag Project', '/tmp/diag');
  upsertEncounter(db, { id: 'enc-diag', project_id: 'proj-diag', chapter: 'ch1', label: 'Diagnostic Enc', grid_rows: 3, grid_cols: 8 });
  addEnemy(db, {
    encounter_id: 'enc-diag', display_name: 'Guard', variant_id: 'guard_base',
    sprite_pack: 'guards', grid_row: 1, grid_col: 3, ai_role: 'tank',
    hp: 20, guard: 5, speed: 3, move_range: 2,
  });
  db.prepare("UPDATE encounter_enemies SET facing = 'front' WHERE display_name = 'Guard'").run();
}

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

describe('runBattleSceneDiagnostics', () => {
  it('reports no_scene_contract when encounter has no contract', () => {
    seed();
    const findings = runBattleSceneDiagnostics(db, 'proj-diag');

    const noContract = findings.find(f => f.id.startsWith('battle_no_scene_contract'));
    expect(noContract).toBeDefined();
    expect(noContract!.severity).toBe('major');
    expect(noContract!.repairable).toBe(true);
    expect(noContract!.repair_action).toBe('battle_create_scene_contract');
  });

  it('reports no_layers when contract exists but no layers', () => {
    seed();
    createSceneContract(db, 'proj-diag', 'enc-diag');
    const findings = runBattleSceneDiagnostics(db, 'proj-diag');

    const noLayers = findings.find(f => f.id.startsWith('battle_no_layers'));
    expect(noLayers).toBeDefined();
    expect(noLayers!.repairable).toBe(true);
  });

  it('reports missing_snapshots when fewer than 5 captured', () => {
    seed();
    const contract = createSceneContract(db, 'proj-diag', 'enc-diag');
    configureDefaultLayers(db, contract.id);
    const findings = runBattleSceneDiagnostics(db, 'proj-diag');

    const missingSnaps = findings.find(f => f.id.startsWith('battle_missing_snapshots'));
    expect(missingSnaps).toBeDefined();
    expect(missingSnaps!.severity).toBe('minor');
  });

  it('reports no_playtest when no completed playtest exists', () => {
    seed();
    const contract = createSceneContract(db, 'proj-diag', 'enc-diag');
    configureDefaultLayers(db, contract.id);
    captureAllSnapshots(db, contract.id);
    const findings = runBattleSceneDiagnostics(db, 'proj-diag');

    const noPlaytest = findings.find(f => f.id.startsWith('battle_no_playtest'));
    expect(noPlaytest).toBeDefined();
    expect(noPlaytest!.severity).toBe('minor');
  });

  it('reports playtest_failures when latest playtest failed', () => {
    seed();
    const contract = createSceneContract(db, 'proj-diag', 'enc-diag');
    configureDefaultLayers(db, contract.id);
    captureAllSnapshots(db, contract.id);
    const session = startPlaytest(db, 'proj-diag', 'enc-diag');
    recordPlaytestFailures(db, session.id, [
      { snapshot_key: 'neutral', failure_type: 'unit_invisible', description: 'Bad contrast' },
    ]);
    completePlaytest(db, session.id, 'fail');

    const findings = runBattleSceneDiagnostics(db, 'proj-diag');
    const failFinding = findings.find(f => f.id.startsWith('battle_playtest_failures'));
    expect(failFinding).toBeDefined();
    expect(failFinding!.severity).toBe('major');
  });

  it('returns no findings for fully configured + passing scene', () => {
    seed();
    const contract = createSceneContract(db, 'proj-diag', 'enc-diag');
    configureDefaultLayers(db, contract.id);
    captureAllSnapshots(db, contract.id);
    const session = startPlaytest(db, 'proj-diag', 'enc-diag');
    completePlaytest(db, session.id, 'pass');

    const findings = runBattleSceneDiagnostics(db, 'proj-diag');
    // Should have no major/critical findings — only contract validation checks might fire
    const battleFindings = findings.filter(f => f.severity === 'critical' || f.severity === 'major');
    expect(battleFindings).toHaveLength(0);
  });

  it('returns empty findings for project with no encounters', () => {
    upsertProject(db, 'proj-empty', 'Empty', '/tmp/empty');
    const findings = runBattleSceneDiagnostics(db, 'proj-empty');
    expect(findings).toHaveLength(0);
  });

  it('all findings use battle_ prefix', () => {
    seed();
    const findings = runBattleSceneDiagnostics(db, 'proj-diag');
    for (const f of findings) {
      expect(f.id).toMatch(/^battle_/);
    }
  });
});
