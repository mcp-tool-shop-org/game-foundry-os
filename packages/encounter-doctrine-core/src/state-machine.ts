import type Database from 'better-sqlite3';
import type { EncounterProductionState, StateEventRow } from '@mcptoolshop/game-foundry-registry';

/** Ordered encounter lifecycle states */
export const ENCOUNTER_PRODUCTION_STATES: EncounterProductionState[] = [
  'draft',
  'intent_defined',
  'roster_defined',
  'formation_defined',
  'rules_defined',
  'validated_structural',
  'dependencies_resolved',
  'manifest_exported',
  'engine_synced',
  'runtime_verified',
  'proved',
  'frozen',
];

/** Legal forward transitions */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'draft': ['intent_defined'],
  'intent_defined': ['roster_defined'],
  'roster_defined': ['formation_defined'],
  'formation_defined': ['rules_defined', 'validated_structural'],
  'rules_defined': ['validated_structural'],
  'validated_structural': ['dependencies_resolved'],
  'dependencies_resolved': ['manifest_exported'],
  'manifest_exported': ['engine_synced'],
  'engine_synced': ['runtime_verified'],
  'runtime_verified': ['proved'],
  'proved': ['frozen'],
};

export function canEncounterTransition(
  from: EncounterProductionState,
  to: EncounterProductionState,
): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

export interface EncounterTransitionResult {
  encounter_id: string;
  from_state: EncounterProductionState;
  to_state: EncounterProductionState;
  event_id: number;
}

/**
 * Advance an encounter's production state. Writes an immutable state_events row.
 * Throws if the transition is not legal.
 */
export function transitionEncounterState(
  db: Database.Database,
  encounterId: string,
  toState: EncounterProductionState,
  options: {
    reason?: string;
    toolName?: string;
    payload?: Record<string, unknown>;
  } = {},
): EncounterTransitionResult {
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId) as
    | { production_state: EncounterProductionState; project_id: string } | undefined;

  if (!encounter) throw new Error(`Encounter not found: ${encounterId}`);

  const fromState = encounter.production_state;

  if (!canEncounterTransition(fromState, toState)) {
    throw new Error(
      `Invalid transition: ${fromState} → ${toState} for encounter ${encounterId}. ` +
      `Allowed: ${(ALLOWED_TRANSITIONS[fromState] || []).join(', ') || 'none'}`,
    );
  }

  // Write immutable event
  const result = db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name, payload_json)
    VALUES (?, 'encounter', ?, ?, ?, ?, ?, ?)
  `).run(
    encounter.project_id,
    encounterId,
    fromState,
    toState,
    options.reason ?? null,
    options.toolName ?? null,
    options.payload ? JSON.stringify(options.payload) : null,
  );

  // Update encounter
  db.prepare("UPDATE encounters SET production_state = ?, updated_at = datetime('now') WHERE id = ?")
    .run(toState, encounterId);

  return {
    encounter_id: encounterId,
    from_state: fromState,
    to_state: toState,
    event_id: Number(result.lastInsertRowid),
  };
}

/** Get current production state for an encounter */
export function getEncounterProductionState(
  db: Database.Database,
  encounterId: string,
): EncounterProductionState {
  const row = db.prepare('SELECT production_state FROM encounters WHERE id = ?').get(encounterId) as
    | { production_state: EncounterProductionState } | undefined;
  if (!row) throw new Error(`Encounter not found: ${encounterId}`);
  return row.production_state;
}

/** Get all state events for an encounter */
export function getEncounterStateEvents(
  db: Database.Database,
  encounterId: string,
): StateEventRow[] {
  return db.prepare(
    'SELECT * FROM state_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC',
  ).all('encounter', encounterId) as StateEventRow[];
}
