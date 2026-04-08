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

// ─── Phase 5 types ─────────────────────────────────────────

/** Bootstrap modes */
export type BootstrapMode = 'blank' | 'story_first' | 'combat_first' | 'import_existing';
export type BootstrapResult = 'pending' | 'pass' | 'fail' | 'partial';

export interface ProjectTemplateRow {
  id: string;
  template_key: string;
  display_name: string;
  engine: string;
  genre_profile: string | null;
  version: string;
  description: string | null;
  created_at: string;
}

export interface ProjectBootstrapRow {
  id: string;
  project_id: string;
  template_id: string | null;
  bootstrap_mode: BootstrapMode;
  target_path: string;
  result: BootstrapResult;
  details_json: string | null;
  receipt_hash: string | null;
  created_at: string;
}

export interface BootstrapArtifactRow {
  id: number;
  project_bootstrap_id: string;
  artifact_type: string;
  path: string;
  content_hash: string | null;
  created_at: string;
}

export interface TemplatePolicyRow {
  id: string;
  template_id: string;
  policy_key: string;
  policy_json: string | null;
  created_at: string;
}

/** Project health status derived from engine truth */
export type ProjectHealthStatus = 'ready' | 'blocked' | 'incomplete' | 'drifted';

/** Engine truth snapshot embedded in project status */
export interface EngineTruth {
  project_config_valid: boolean;
  shell_compliance: boolean;
  autoload_count: number;
  missing_autoloads: string[];
  display_width: number;
  display_height: number;
  stretch_mode: string;
  scale_mode: string;
  renderer: string;
}

export interface ProjectStatusResult {
  project_id: string;
  template_used: string | null;
  bootstrap_result: BootstrapResult | null;
  status: ProjectHealthStatus;
  blockers: string[];
  warnings: string[];
  installed_shells: {
    canon: boolean;
    registry: boolean;
    runtime: boolean;
    theme: boolean;
    proof: boolean;
  };
  missing_shells: string[];
  repair_candidates: string[];
  next_step: string;
  engine_truth: EngineTruth;
}

/** A single diagnostic finding with source tracing */
export interface DiagnosticFinding {
  id: string;
  severity: 'critical' | 'major' | 'minor';
  source_tool: string;
  affected_path: string;
  message: string;
  repairable: boolean;
  repair_action: string | null;
}

export interface BootstrapDiagnosticResult {
  project_id: string;
  pass: boolean;
  findings: DiagnosticFinding[];
  blocker_count: number;
  warning_count: number;
  repair_candidates: string[];
  next_action: string;
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

// ─── v1.3.0 Repair Closure Spine ──────────────────────────

/** Risk classification for repair actions */
export type RepairRiskLevel = 'safe' | 'moderate' | 'destructive';

/** Lifecycle states for a repair plan */
export type RepairPlanStatus =
  | 'planned'
  | 'dry_run_passed'
  | 'applied'
  | 'verified'
  | 'closed'
  | 'failed'
  | 'escalated';

/** Receipt result */
export type RepairReceiptStatus = 'pending' | 'pass' | 'fail' | 'partial';

/** Per-step execution result */
export type RepairStepResult = 'attempted' | 'applied' | 'skipped' | 'failed';

/** Repair state tracked per diagnostic finding */
export type FindingRepairState =
  | 'unplanned'
  | 'planned'
  | 'dry_run_passed'
  | 'applied_pending_recheck'
  | 'closed'
  | 'escalated'
  | 'failed';

/** Enhanced finding with repair state tracking */
export interface DiagnosticFindingV2 extends DiagnosticFinding {
  repair_state: FindingRepairState;
  last_receipt_id: string | null;
}

/** Static contract for a known repair action */
export interface RepairActionContract {
  action_key: string;
  display_name: string;
  risk_level: RepairRiskLevel;
  dry_run_supported: boolean;
  postchecks: string[];
  preconditions: string[];
  expected_effects: string[];
  scope: 'filesystem' | 'registry' | 'godot_config' | 'mixed';
}

/** A single step in a repair plan */
export interface RepairPlanStep {
  step_index: number;
  action: string;
  target_path: string;
  expected_change: string;
  risk: RepairRiskLevel;
}

// ─── Repair row types ─────────────────────────────────────

export interface RepairPlanRow {
  id: string;
  project_id: string;
  finding_ids_json: string;
  action_key: string;
  target: string;
  mode: string;
  plan_fingerprint: string;
  steps_json: string;
  expected_effects_json: string | null;
  preconditions_json: string | null;
  status: RepairPlanStatus;
  created_at: string;
}

export interface RepairReceiptRow {
  id: string;
  project_id: string;
  plan_id: string;
  action_key: string;
  mode: string;
  before_json: string | null;
  after_json: string | null;
  changed_targets_json: string | null;
  step_results_json: string;
  verification_json: string | null;
  status_delta_json: string | null;
  receipt_hash: string | null;
  status: RepairReceiptStatus;
  created_at: string;
}

export interface RepairRegressionRow {
  id: string;
  project_id: string;
  receipt_id: string;
  regression_type: string;
  severity: string;
  details_json: string | null;
  created_at: string;
}

// ─── Repair API types ─────────────────────────────────────

/** Result from planRepair */
export interface RepairPlanResult {
  plan_id: string;
  action_key: string;
  finding_ids: string[];
  steps: RepairPlanStep[];
  expected_effects: string[];
  precondition_check: { passed: boolean; failures: string[] };
  plan_fingerprint: string;
  can_dry_run: boolean;
  can_apply: boolean;
  blockers: string[];
}

/** Per-step result in a receipt */
export interface RepairStepResultEntry {
  step_index: number;
  result: RepairStepResult;
  detail: string;
}

/** Result from applyRepair */
export interface RepairApplyResult {
  receipt_id: string;
  plan_id: string;
  action_key: string;
  mode: 'dry_run' | 'apply';
  step_results: RepairStepResultEntry[];
  verification: {
    ran: boolean;
    passed: boolean;
    findings_cleared: string[];
    new_findings: string[];
  } | null;
  status_delta: { from: string; to: string } | null;
  receipt_hash: string;
}

/** Result from verifyRepairClosure */
export interface RepairVerificationResult {
  receipt_id: string;
  plan_id: string;
  action_key: string;
  findings_before: string[];
  findings_after: string[];
  findings_cleared: string[];
  findings_new: string[];
  regressions_detected: boolean;
  status_transition: { from: ProjectHealthStatus; to: ProjectHealthStatus } | null;
  closed: boolean;
}

/** Enhanced next-step with repair awareness */
export interface StudioNextStepV2 {
  action: string;
  action_key: string | null;
  target: string | null;
  reason: string;
  priority: 'critical' | 'normal' | 'low';
  source: string | null;
  can_dry_run: boolean;
  can_apply: boolean;
  expected_outcome: string;
}

// ─── v1.4.0 Adoption + Quality Spine ─────────────────────

/** Quality domains for game project health */
export type QualityDomain =
  | 'visual_integrity'
  | 'runtime_integrity'
  | 'encounter_integrity'
  | 'canon_integrity'
  | 'playability_integrity'
  | 'shipping_integrity';

/** Per-domain quality status */
export type QualityDomainStatus = 'healthy' | 'warning' | 'degraded' | 'blocked' | 'unknown';

/** Quality domain state snapshot */
export interface QualityDomainState {
  domain: QualityDomain;
  status: QualityDomainStatus;
  blocker_count: number;
  warning_count: number;
  finding_ids: string[];
  next_action: string | null;
}

/** Adoption profiles for project intake */
export type AdoptionProfile =
  | 'greenfield'
  | 'retrofit_prototype'
  | 'vertical_slice'
  | 'late_stage_production';

/** Risk classification for partitioning findings */
export type RepairRiskClass =
  | 'safe_auto'
  | 'approval_required'
  | 'manual_only'
  | 'advisory';

/** Approval status for repair plans */
export type RepairApprovalStatus =
  | 'not_required'
  | 'pending_approval'
  | 'approved'
  | 'rejected';

/** One stage in an adoption plan */
export interface AdoptionStage {
  stage: number;
  name: string;
  description: string;
  actions: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

/** Complete adoption plan */
export interface AdoptionPlan {
  plan_id: string;
  project_id: string;
  profile: AdoptionProfile;
  stages: AdoptionStage[];
  current_stage: number;
  completion: { total_stages: number; completed_stages: number; pct: number };
  partitioned_findings: Record<RepairRiskClass, string[]>;
  best_next_move: string;
}

/** Extended repair plan row with approval columns */
export interface RepairPlanRowV2 extends RepairPlanRow {
  approval_status: RepairApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  risk_class: RepairRiskClass;
}

/** Quality-aware next step */
export interface StudioNextStepV3 extends StudioNextStepV2 {
  quality_domain: QualityDomain | null;
  why_it_matters: string;
}

/** Quality domain state row (DB table) */
export interface QualityDomainStateRow {
  id: string;
  project_id: string;
  domain: string;
  status: string;
  blocker_count: number;
  warning_count: number;
  finding_ids_json: string | null;
  next_action: string | null;
  computed_at: string;
}

/** Adoption plan row (DB table) */
export interface AdoptionPlanRow {
  id: string;
  project_id: string;
  profile: string;
  current_stage: number;
  stages_json: string;
  completion_json: string | null;
  created_at: string;
  updated_at: string;
}
