/** Production pipeline states */
export type ProductionState = 'none' | 'in_progress' | 'complete' | 'frozen';

/** Sync / proving states */
export type SyncState = 'none' | 'synced' | 'stale' | 'error';
export type ProofState = 'none' | 'passed' | 'failed' | 'stale';

/** Character roles */
export type CharacterRole = 'party' | 'enemy' | 'boss' | 'npc' | 'miniboss';

/** Variant types */
export type VariantType = 'base' | 'phase2' | 'portrait' | 'alt';

/** Pack types */
export type PackType = 'enemy' | 'party' | 'boss' | 'npc';

// ─── Row types (match SQLite tables) ───────────────────────

export interface ProjectRow {
  id: string;
  display_name: string;
  root_path: string;
  created_at: string;
  updated_at: string;
}

export interface CharacterRow {
  id: string;
  project_id: string;
  display_name: string;
  role: CharacterRole | null;
  family: string | null;
  faction: string | null;
  ai_role: string | null;
  chapter_primary: string | null;
  concept_status: ProductionState;
  directional_status: ProductionState;
  sheet_status: ProductionState;
  pack_status: ProductionState;
  portrait_status: ProductionState;
  integration_status: ProductionState;
  freeze_status: ProductionState;
  created_at: string;
  updated_at: string;
}

export interface VariantRow {
  id: string;
  character_id: string;
  variant_type: VariantType;
  pack_id: string | null;
  phase: number | null;
  concept_dir: string | null;
  directional_dir: string | null;
  sheet_path: string | null;
  pack_dir: string | null;
  sheet_present: number;
  pack_present: number;
  directions_present: number;
  content_hash: string | null;
  proof_state: ProofState;
  created_at: string;
  updated_at: string;
}

export interface AssetPackRow {
  id: string;
  project_id: string;
  pack_type: PackType;
  chapter: string | null;
  sprite_size: number;
  directions: number;
  root_path: string;
  manifest_path: string | null;
  member_count: number;
  complete_members: number;
  engine_sync_state: SyncState;
  freeze_state: ProductionState;
  created_at: string;
  updated_at: string;
}

export interface EncounterRow {
  id: string;
  project_id: string;
  chapter: string;
  label: string;
  doctrine: string | null;
  max_turns: number | null;
  description: string | null;
  grid_rows: number;
  grid_cols: number;
  route_nodes: string | null;
  bounds_valid: number | null;
  formation_valid: number | null;
  variants_valid: number | null;
  last_validated_at: string | null;
  runtime_sync_state: SyncState;
  proving_state: ProofState;
  created_at: string;
  updated_at: string;
}

export interface EncounterEnemyRow {
  id: number;
  encounter_id: string;
  display_name: string;
  variant_id: string;
  sprite_pack: string;
  ai_role: string | null;
  grid_row: number;
  grid_col: number;
  hp: number | null;
  guard: number | null;
  speed: number | null;
  move_range: number | null;
  engine_data: string | null;
  sort_order: number;
}

export interface FreezeLogRow {
  id: number;
  object_type: string;
  object_id: string;
  content_hash: string | null;
  frozen_at: string;
  frozen_by: string | null;
  notes: string | null;
}

// ─── API types (for tool responses) ────────────────────────

export interface CharacterStatus extends CharacterRow {
  variants: VariantRow[];
  next_step: string;
}

export interface ValidationResult {
  check: string;
  pass: boolean;
  detail: string;
}

export interface CompletenessReport {
  character_id: string;
  checks: ValidationResult[];
  overall_pass: boolean;
  completeness_pct: number;
}

export interface BoundsCheckResult {
  encounter_id: string;
  grid: { rows: number; cols: number };
  enemies: Array<{
    name: string;
    variant_id: string;
    row: number;
    col: number;
    in_bounds: boolean;
  }>;
  pass: boolean;
  violations: string[];
}

export interface FormationCheckResult {
  encounter_id: string;
  checks: ValidationResult[];
  pass: boolean;
}

export interface VariantCheckResult {
  encounter_id: string;
  enemies: Array<{
    name: string;
    variant_id: string;
    variant_exists: boolean;
    pack_exists: boolean;
  }>;
  pass: boolean;
  missing: string[];
}
