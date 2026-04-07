import type Database from 'better-sqlite3';
import type { VariantProductionState, StateEventRow } from '@mcptoolshop/game-foundry-registry';

/** Ordered lifecycle states */
export const PRODUCTION_STATES: VariantProductionState[] = [
  'draft',
  'concept_batch_started',
  'concept_candidates_recorded',
  'concept_locked',
  'directional_batch_started',
  'directional_locked',
  'sheet_assembled',
  'pack_sliced',
  'engine_synced',
  'proved',
  'frozen',
];

/** Legal forward transitions */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  'draft': ['concept_batch_started'],
  'concept_batch_started': ['concept_candidates_recorded'],
  'concept_candidates_recorded': ['concept_locked'],
  'concept_locked': ['directional_batch_started'],
  'directional_batch_started': ['directional_locked'],
  'directional_locked': ['sheet_assembled'],
  'sheet_assembled': ['pack_sliced'],
  'pack_sliced': ['engine_synced'],
  'engine_synced': ['proved'],
  'proved': ['frozen'],
};

export function canTransition(from: VariantProductionState, to: VariantProductionState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

export interface TransitionResult {
  variant_id: string;
  from_state: VariantProductionState;
  to_state: VariantProductionState;
  event_id: number;
}

/**
 * Advance a variant's production state. Writes an immutable state_events row.
 * Throws if the transition is not legal.
 */
export function transitionState(
  db: Database.Database,
  variantId: string,
  toState: VariantProductionState,
  options: {
    reason?: string;
    toolName?: string;
    projectId?: string;
    payload?: Record<string, unknown>;
  } = {},
): TransitionResult {
  const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId) as
    | { production_state: VariantProductionState; character_id: string } | undefined;

  if (!variant) throw new Error(`Variant not found: ${variantId}`);

  const fromState = variant.production_state;

  if (!canTransition(fromState, toState)) {
    throw new Error(
      `Invalid transition: ${fromState} → ${toState} for variant ${variantId}. ` +
      `Allowed: ${(ALLOWED_TRANSITIONS[fromState] || []).join(', ') || 'none'}`,
    );
  }

  // Look up project_id from character
  let projectId = options.projectId;
  if (!projectId) {
    const char = db.prepare('SELECT project_id FROM characters WHERE id = ?')
      .get(variant.character_id) as { project_id: string } | undefined;
    projectId = char?.project_id ?? 'unknown';
  }

  // Write immutable event
  const result = db.prepare(`
    INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name, payload_json)
    VALUES (?, 'variant', ?, ?, ?, ?, ?, ?)
  `).run(
    projectId,
    variantId,
    fromState,
    toState,
    options.reason ?? null,
    options.toolName ?? null,
    options.payload ? JSON.stringify(options.payload) : null,
  );

  // Update variant
  db.prepare("UPDATE variants SET production_state = ?, updated_at = datetime('now') WHERE id = ?")
    .run(toState, variantId);

  return {
    variant_id: variantId,
    from_state: fromState,
    to_state: toState,
    event_id: Number(result.lastInsertRowid),
  };
}

/** Get all state events for an entity */
export function getStateEvents(
  db: Database.Database,
  entityType: string,
  entityId: string,
): StateEventRow[] {
  return db.prepare(
    'SELECT * FROM state_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC',
  ).all(entityType, entityId) as StateEventRow[];
}

/** Get current production state for a variant */
export function getProductionState(db: Database.Database, variantId: string): VariantProductionState {
  const row = db.prepare('SELECT production_state FROM variants WHERE id = ?').get(variantId) as
    | { production_state: VariantProductionState } | undefined;
  if (!row) throw new Error(`Variant not found: ${variantId}`);
  return row.production_state;
}
