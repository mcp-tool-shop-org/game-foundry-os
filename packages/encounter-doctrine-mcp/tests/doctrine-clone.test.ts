import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase, upsertProject, upsertEncounter, addEnemy,
} from '@mcptoolshop/game-foundry-registry';
import {
  getEncounterProductionState,
  addUnit,
  getUnits,
  getUnitCount,
  attachRule,
  getRules,
} from '@mcptoolshop/encounter-doctrine-core';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test', '/tmp/test');

  // Source encounter with 2 units and 1 rule
  upsertEncounter(db, { id: 'enc_src', project_id: 'test', chapter: 'ch1', label: 'Source Battle', grid_rows: 4, grid_cols: 10 });
  db.prepare("UPDATE encounters SET display_name = 'Source Battle', encounter_type = 'boss', route_tag = 'route_a', intent_summary = 'Test clone' WHERE id = 'enc_src'").run();

  addUnit(db, { encounter_id: 'enc_src', display_name: 'Goblin', variant_id: 'g_base', sprite_pack: 'g_pack', grid_row: 0, grid_col: 2, hp: 30, sort_order: 0 });
  addUnit(db, { encounter_id: 'enc_src', display_name: 'Orc', variant_id: 'o_base', sprite_pack: 'o_pack', grid_row: 2, grid_col: 5, hp: 60, sort_order: 1 });
  attachRule(db, { encounter_id: 'enc_src', rule_type: 'phase_transition', rule_key: 'hp_50', rule_payload_json: JSON.stringify({ threshold: 0.5 }) });
});

function cloneEncounter(sourceId: string, newId: string, newLabel?: string) {
  const source = db.prepare('SELECT * FROM encounters WHERE id = ?').get(sourceId) as any;
  if (!source) throw new Error(`Source not found: ${sourceId}`);

  const label = newLabel ?? `${source.label} (clone)`;
  upsertEncounter(db, {
    id: newId,
    project_id: source.project_id,
    chapter: source.chapter,
    label,
    doctrine: source.doctrine ?? undefined,
    max_turns: source.max_turns ?? undefined,
    grid_rows: source.grid_rows,
    grid_cols: source.grid_cols,
    route_nodes: source.route_nodes ? JSON.parse(source.route_nodes) : undefined,
  });

  db.prepare(`
    UPDATE encounters SET display_name = ?, encounter_type = ?, route_tag = ?, intent_summary = ?, production_state = 'draft' WHERE id = ?
  `).run(label, source.encounter_type, source.route_tag, source.intent_summary, newId);

  const units = getUnits(db, sourceId);
  for (const u of units) {
    addUnit(db, {
      encounter_id: newId,
      display_name: u.display_name,
      variant_id: u.variant_id,
      sprite_pack: u.sprite_pack,
      grid_row: u.grid_row,
      grid_col: u.grid_col,
      hp: u.hp ?? undefined,
      guard: u.guard ?? undefined,
      speed: u.speed ?? undefined,
      move_range: u.move_range ?? undefined,
      sort_order: u.sort_order,
    });
  }

  const rules = getRules(db, sourceId);
  for (const r of rules) {
    attachRule(db, {
      encounter_id: newId,
      rule_type: r.rule_type,
      rule_key: r.rule_key,
      rule_payload_json: r.rule_payload_json ?? undefined,
    });
  }
}

describe('doctrine clone', () => {
  it('clones encounter with same arena dimensions', () => {
    cloneEncounter('enc_src', 'enc_clone');

    const clone = db.prepare('SELECT * FROM encounters WHERE id = ?').get('enc_clone') as any;
    expect(clone).toBeDefined();
    expect(clone.grid_rows).toBe(4);
    expect(clone.grid_cols).toBe(10);
    expect(clone.chapter).toBe('ch1');
  });

  it('clones all units with positions preserved', () => {
    cloneEncounter('enc_src', 'enc_clone');

    const srcUnits = getUnits(db, 'enc_src');
    const cloneUnits = getUnits(db, 'enc_clone');
    expect(cloneUnits).toHaveLength(srcUnits.length);

    for (let i = 0; i < srcUnits.length; i++) {
      expect(cloneUnits[i].display_name).toBe(srcUnits[i].display_name);
      expect(cloneUnits[i].grid_row).toBe(srcUnits[i].grid_row);
      expect(cloneUnits[i].grid_col).toBe(srcUnits[i].grid_col);
      expect(cloneUnits[i].variant_id).toBe(srcUnits[i].variant_id);
    }
  });

  it('clones all rules', () => {
    cloneEncounter('enc_src', 'enc_clone');

    const srcRules = getRules(db, 'enc_src');
    const cloneRules = getRules(db, 'enc_clone');
    expect(cloneRules).toHaveLength(srcRules.length);
    expect(cloneRules[0].rule_type).toBe(srcRules[0].rule_type);
    expect(cloneRules[0].rule_key).toBe(srcRules[0].rule_key);
  });

  it('cloned encounter starts in draft state', () => {
    cloneEncounter('enc_src', 'enc_clone');

    const state = getEncounterProductionState(db, 'enc_clone');
    expect(state).toBe('draft');
  });
});
