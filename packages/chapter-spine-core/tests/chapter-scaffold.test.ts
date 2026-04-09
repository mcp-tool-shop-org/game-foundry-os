import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  getChapter,
  getAuthoringDefaults,
  getScaffoldReceipts,
  getSceneContractByEncounter,
  getLayersByContract,
} from '@mcptoolshop/game-foundry-registry';
import { scaffoldChapter } from '@mcptoolshop/chapter-spine-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'proj-sc', 'Scaffold Project', '/tmp/sc');
}

beforeEach(() => { db = openDatabase(':memory:'); });
afterEach(() => { db.close(); });

describe('scaffoldChapter', () => {
  it('scaffolds a chapter with 3 encounters, scene contracts, and layers', () => {
    seedProject();
    const result = scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1: The Patrol',
      encounters: [
        { encounter_id: 'enc1', display_name: 'Ambush' },
        { encounter_id: 'enc2', display_name: 'Patrol Fight' },
        { encounter_id: 'enc3', display_name: 'Boss Gate' },
      ],
    });

    expect(result.chapter_id).toBe('ch1');
    expect(result.encounters_created).toHaveLength(3);
    expect(result.scene_contracts_created).toHaveLength(3);
    expect(result.layers_configured).toBe(15); // 5 per contract
    expect(result.receipt_id).toMatch(/^csr_/);
  });

  it('creates the chapter with correct fields', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      sort_order: 1,
      intent_summary: 'Introduce basic combat',
      encounters: [{ encounter_id: 'enc1', display_name: 'Test' }],
    });

    const ch = getChapter(db, 'ch1');
    expect(ch).toBeDefined();
    expect(ch!.display_name).toBe('Chapter 1');
    expect(ch!.sort_order).toBe(1);
    expect(ch!.intent_summary).toBe('Introduce basic combat');
    expect(ch!.required_encounter_count).toBe(1);
  });

  it('encounters inherit grid size from defaults', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Test' }],
      defaults: {
        default_grid_rows: 5,
        default_grid_cols: 12,
      },
    });

    const enc = db.prepare('SELECT * FROM encounters WHERE id = ?').get('enc1') as any;
    expect(enc.grid_rows).toBe(5);
    expect(enc.grid_cols).toBe(12);
  });

  it('scene contracts inherit tile/viewport from defaults', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Test' }],
      defaults: {
        default_tile_size_px: 48,
        default_viewport_width: 1920,
        default_viewport_height: 1080,
      },
    });

    const contract = getSceneContractByEncounter(db, 'enc1');
    expect(contract).toBeDefined();
    expect(contract!.tile_size_px).toBe(48);
    expect(contract!.viewport_width).toBe(1920);
    expect(contract!.viewport_height).toBe(1080);
  });

  it('records scaffold receipt with correct counts', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [
        { encounter_id: 'enc1', display_name: 'Fight 1' },
        { encounter_id: 'enc2', display_name: 'Fight 2' },
      ],
    });

    const receipts = getScaffoldReceipts(db, 'ch1');
    expect(receipts).toHaveLength(1);
    expect(receipts[0].encounters_created).toBe(2);
    expect(receipts[0].scene_contracts_created).toBe(2);
    expect(receipts[0].layers_configured).toBe(10);
  });

  it('empty encounters array creates chapter + defaults but no encounters', () => {
    seedProject();
    const result = scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Empty Chapter',
      encounters: [],
    });

    expect(result.encounters_created).toHaveLength(0);
    expect(result.scene_contracts_created).toHaveLength(0);
    expect(result.layers_configured).toBe(0);
    expect(getChapter(db, 'ch1')).toBeDefined();
    expect(getAuthoringDefaults(db, 'ch1')).toBeDefined();
  });

  it('require_scene_contract=false skips scene contracts', () => {
    seedProject();
    const result = scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Test' }],
      defaults: { require_scene_contract: false },
    });

    expect(result.scene_contracts_created).toHaveLength(0);
    expect(result.layers_configured).toBe(0);
    expect(getSceneContractByEncounter(db, 'enc1')).toBeUndefined();
  });

  it('require_ui_layers=false skips layer configuration', () => {
    seedProject();
    const result = scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Test' }],
      defaults: { require_ui_layers: false },
    });

    expect(result.scene_contracts_created).toHaveLength(1);
    expect(result.layers_configured).toBe(0);
    const contract = getSceneContractByEncounter(db, 'enc1');
    expect(contract).toBeDefined();
    const layers = getLayersByContract(db, contract!.id);
    expect(layers).toHaveLength(0);
  });

  it('encounter-level type overrides chapter default', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [
        { encounter_id: 'enc1', display_name: 'Normal Fight' },
        { encounter_id: 'enc2', display_name: 'Big Boss', encounter_type: 'boss' },
      ],
      defaults: { default_encounter_type: 'standard' },
    });

    const enc1 = db.prepare('SELECT encounter_type FROM encounters WHERE id = ?').get('enc1') as any;
    const enc2 = db.prepare('SELECT encounter_type FROM encounters WHERE id = ?').get('enc2') as any;
    expect(enc1.encounter_type).toBe('standard');
    expect(enc2.encounter_type).toBe('boss');
  });

  it('emits state events for scaffold', () => {
    seedProject();
    scaffoldChapter(db, {
      project_id: 'proj-sc',
      chapter_id: 'ch1',
      display_name: 'Chapter 1',
      encounters: [{ encounter_id: 'enc1', display_name: 'Test' }],
    });

    const chapterEvents = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'chapter' AND entity_id = 'ch1' AND tool_name = 'chapter_scaffold'"
    ).all() as any[];
    expect(chapterEvents.length).toBeGreaterThanOrEqual(1);

    const encounterEvents = db.prepare(
      "SELECT * FROM state_events WHERE entity_type = 'encounter' AND entity_id = 'enc1' AND tool_name = 'chapter_scaffold'"
    ).all() as any[];
    expect(encounterEvents.length).toBeGreaterThanOrEqual(1);
  });
});
