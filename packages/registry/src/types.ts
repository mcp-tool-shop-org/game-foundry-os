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

/** Variant production lifecycle states (ordered) */
export type VariantProductionState =
  | 'draft'
  | 'concept_batch_started'
  | 'concept_candidates_recorded'
  | 'concept_locked'
  | 'directional_batch_started'
  | 'directional_locked'
  | 'sheet_assembled'
  | 'pack_sliced'
  | 'engine_synced'
  | 'proved'
  | 'frozen';

/** Batch types */
export type BatchType = 'concept' | 'directional' | 'portrait';
export type BatchStatus = 'open' | 'recorded' | 'locked' | 'cancelled';

/** Pick types */
export type PickType = 'concept' | 'directional';

/** Artifact types */
export type ArtifactType =
  | 'concept_candidate' | 'concept_locked'
  | 'directional_candidate' | 'directional_locked'
  | 'sheet' | 'sheet_preview' | 'sheet_silhouette'
  | 'pack_member' | 'portrait'
  | 'family_strip' | 'silhouette_strip'
  | 'manifest' | 'sync_receipt';

/** Portrait states */
export type PortraitState = 'none' | 'missing' | 'attached' | 'complete';

/** Encounter production lifecycle states */
export type EncounterProductionState =
  | 'draft'
  | 'intent_defined'
  | 'roster_defined'
  | 'formation_defined'
  | 'rules_defined'
  | 'validated_structural'
  | 'dependencies_resolved'
  | 'manifest_exported'
  | 'engine_synced'
  | 'runtime_verified'
  | 'proved'
  | 'frozen';

/** Encounter types */
export type EncounterType = 'standard' | 'boss' | 'miniboss' | 'gauntlet';

/** Encounter rule types */
export type EncounterRuleType = 'phase_transition' | 'reinforcement' | 'win_condition' | 'loss_condition' | 'special';

/** Encounter validation types */
export type EncounterValidationType = 'bounds' | 'formation' | 'variants' | 'packs' | 'rules' | 'runtime';

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
  production_state: VariantProductionState;
  portrait_state: PortraitState;
  display_name: string | null;
  runtime_variant_name: string | null;
  canonical_pack_name: string | null;
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
  production_state: EncounterProductionState;
  display_name: string | null;
  encounter_type: EncounterType;
  route_tag: string | null;
  intent_summary: string | null;
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
  role_tag: string | null;
  team: string;
  spawn_group: string | null;
  facing: string | null;
  engine_profile_json: string | null;
  character_id: string | null;
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

// ─── Phase 1 row types ─────────────────────────────────────

export interface FoundryBatchRow {
  id: string;
  variant_id: string;
  batch_type: BatchType;
  direction: string | null;
  candidate_count: number;
  source_model: string | null;
  params_json: string | null;
  output_dir: string | null;
  status: BatchStatus;
  created_at: string;
}

export interface LockedPickRow {
  id: string;
  variant_id: string;
  pick_type: PickType;
  direction: string | null;
  candidate_name: string | null;
  candidate_index: number | null;
  locked_artifact_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ArtifactRow {
  id: string;
  project_id: string;
  variant_id: string;
  artifact_type: ArtifactType;
  direction: string | null;
  path: string;
  content_hash: string | null;
  width: number | null;
  height: number | null;
  metadata_json: string | null;
  is_canonical: number;
  created_at: string;
}

export interface StateEventRow {
  id: number;
  project_id: string;
  entity_type: string;
  entity_id: string;
  from_state: string | null;
  to_state: string;
  reason: string | null;
  tool_name: string | null;
  payload_json: string | null;
  created_at: string;
}

// ─── Phase 4 types ─────────────────────────────────────────

/** Canon page kinds */
export type CanonKind = 'project' | 'chapter' | 'character' | 'faction' | 'encounter' | 'combat_doctrine' | 'art_doctrine' | 'proof_note' | 'handoff';

/** Canon trust states */
export type CanonStatus = 'unregistered' | 'registered' | 'linked' | 'synced' | 'drift_warning' | 'canonical' | 'archived';

/** Canon link types */
export type CanonLinkType = 'describes' | 'governs' | 'proves' | 'tracks' | 'handoff_for' | 'freeze_note_for';

/** Canon drift results */
export type CanonDriftResult = 'clean' | 'drift' | 'warning';

/** Handoff artifact types */
export type HandoffArtifactType = 'chapter_handoff' | 'freeze_packet' | 'production_brief' | 'sprint_handoff';

export interface CanonPageRow {
  id: string;
  project_id: string;
  canon_id: string;
  kind: CanonKind;
  title: string;
  vault_path: string;
  status: CanonStatus;
  content_hash: string | null;
  frontmatter_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface CanonLinkRow {
  id: string;
  project_id: string;
  source_canon_id: string;
  target_type: string;
  target_id: string;
  link_type: CanonLinkType;
  created_at: string;
}

export interface CanonSnapshotRow {
  id: string;
  project_id: string;
  canon_id: string;
  content_hash: string;
  parsed_body_json: string | null;
  created_at: string;
}

export interface CanonDriftReportRow {
  id: string;
  project_id: string;
  scope_type: string;
  scope_id: string;
  result: CanonDriftResult;
  details_json: string | null;
  created_at: string;
}

export interface HandoffArtifactRow {
  id: string;
  project_id: string;
  scope_type: string;
  scope_id: string;
  artifact_type: HandoffArtifactType;
  output_path: string | null;
  content_hash: string | null;
  details_json: string | null;
  created_at: string;
}

// ─── Phase 3 types ─────────────────────────────────────────

/** Proof states */
export type ProofRunResult = 'pass' | 'fail' | 'partial';
export type AssertionStatus = 'pass' | 'fail' | 'warn' | 'skip';
export type FreezeCandidateStatus = 'candidate' | 'blocked' | 'promoted' | 'revoked';
export type FreezeReadiness = 'ready' | 'blocked' | 'warning_only';
export type RegressionSeverity = 'critical' | 'major' | 'minor';

export interface ProofSuiteRow {
  id: string;
  project_id: string;
  suite_key: string;
  scope_type: string;
  display_name: string;
  description: string | null;
  is_blocking: number;
  created_at: string;
}

export interface ProofRunRow {
  id: string;
  project_id: string;
  suite_id: string | null;
  scope_type: string;
  scope_id: string;
  result: ProofRunResult;
  blocking_failures: number;
  warning_count: number;
  receipt_hash: string | null;
  summary: string | null;
  details_json: string | null;
  tool_name: string | null;
  created_at: string;
}

export interface ProofAssertionRow {
  id: number;
  proof_run_id: string;
  assertion_key: string;
  status: AssertionStatus;
  message: string | null;
  details_json: string | null;
  created_at: string;
}

export interface FreezePolicyRow {
  id: string;
  project_id: string;
  scope_type: string;
  scope_id: string;
  policy_key: string;
  policy_json: string | null;
  created_at: string;
}

export interface FreezeCandidateRow {
  id: string;
  project_id: string;
  scope_type: string;
  scope_id: string;
  status: FreezeCandidateStatus;
  blocking_reasons_json: string | null;
  warning_reasons_json: string | null;
  candidate_hash: string | null;
  created_at: string;
}

export interface FreezeReceiptRow {
  id: string;
  project_id: string;
  scope_type: string;
  scope_id: string;
  source_candidate_id: string | null;
  receipt_hash: string | null;
  freeze_summary: string | null;
  details_json: string | null;
  created_at: string;
}

export interface RegressionRow {
  id: string;
  project_id: string;
  scope_type: string;
  scope_id: string;
  regression_type: string;
  from_run_id: string | null;
  to_run_id: string | null;
  severity: RegressionSeverity;
  details_json: string | null;
  created_at: string;
}

export interface FreezeReadinessResult {
  scope_type: string;
  scope_id: string;
  readiness: FreezeReadiness;
  blocking_reasons: string[];
  warning_reasons: string[];
  latest_proof_runs: ProofRunRow[];
  next_action: string;
}

// ─── Phase 2 row types ─────────────────────────────────────

export interface EncounterRuleRow {
  id: string;
  encounter_id: string;
  rule_type: EncounterRuleType;
  rule_key: string;
  rule_payload_json: string | null;
  created_at: string;
}

export interface EncounterExportRow {
  id: string;
  encounter_id: string;
  project_id: string;
  manifest_path: string;
  content_hash: string | null;
  format_version: string;
  export_payload_json: string | null;
  is_canonical: number;
  created_at: string;
}

export interface EncounterSyncReceiptRow {
  id: string;
  encounter_id: string;
  project_id: string;
  target_path: string;
  synced_files_json: string | null;
  verification_status: string;
  receipt_hash: string | null;
  created_at: string;
}

export interface EncounterValidationRunRow {
  id: number;
  encounter_id: string;
  validation_type: EncounterValidationType;
  result: string;
  details_json: string | null;
  created_at: string;
}

export interface EncounterNextStepResult {
  encounter_id: string;
  production_state: EncounterProductionState;
  runtime_sync_state: string;
  unit_count: number;
  missing_validations: string[];
  missing_dependencies: string[];
  export_status: string;
  sync_status: string;
  next_action: string;
  blockers: string[];
}

// ─── Phase 1 API types ─────────────────────────────────────

export interface NextStepResult {
  variant_id: string;
  production_state: VariantProductionState;
  portrait_state: PortraitState;
  missing_locks: string[];
  missing_artifacts: string[];
  engine_synced: boolean;
  next_action: string;
  blockers: string[];
}

export interface TimelineEntry {
  timestamp: string;
  type: 'state_change' | 'batch' | 'pick' | 'artifact' | 'sync';
  summary: string;
  detail: Record<string, unknown>;
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
