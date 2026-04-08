import type Database from 'better-sqlite3';
import type { EncounterRuleRow } from '@mcptoolshop/game-foundry-registry';
import { randomUUID } from 'node:crypto';

export interface AttachRuleInput {
  encounter_id: string;
  rule_type: string;
  rule_key: string;
  rule_payload_json?: string;
}

export function attachRule(db: Database.Database, input: AttachRuleInput): EncounterRuleRow {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO encounter_rules (id, encounter_id, rule_type, rule_key, rule_payload_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, input.encounter_id, input.rule_type, input.rule_key, input.rule_payload_json ?? null);

  return db.prepare('SELECT * FROM encounter_rules WHERE id = ?').get(id) as EncounterRuleRow;
}

export function getRules(db: Database.Database, encounterId: string): EncounterRuleRow[] {
  return db.prepare(
    'SELECT * FROM encounter_rules WHERE encounter_id = ? ORDER BY created_at ASC',
  ).all(encounterId) as EncounterRuleRow[];
}

export function removeRule(db: Database.Database, ruleId: string): void {
  const existing = db.prepare('SELECT * FROM encounter_rules WHERE id = ?').get(ruleId);
  if (!existing) throw new Error(`Rule not found: ${ruleId}`);
  db.prepare('DELETE FROM encounter_rules WHERE id = ?').run(ruleId);
}
