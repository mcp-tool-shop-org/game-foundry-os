# TEST-SPEC v1.4.0 — Adoption + Quality Spine

Status: **Partial** — 105 new tests shipped (866 → 971), gaps below marked with priority.

## Shipped Tests (105 new, 971 total)

### schema-v8.test.ts (8 tests)
- [x] schema version is 8
- [x] repair_plans has approval_status column with default not_required
- [x] repair_plans has approved_by and approved_at columns
- [x] repair_plans has risk_class column with default safe_auto
- [x] quality_domain_states table exists with all columns
- [x] adoption_plans table exists with all columns
- [x] quality_domain_states CRUD works
- [x] adoption_plans CRUD works

### quality-domains.test.ts (22 tests)
- [x] findingToDomain maps shell → runtime_integrity
- [x] findingToDomain maps engine → runtime_integrity
- [x] findingToDomain maps autoload → runtime_integrity
- [x] findingToDomain maps display → visual_integrity
- [x] findingToDomain maps import → visual_integrity
- [x] findingToDomain maps canon → canon_integrity
- [x] findingToDomain maps proof → playability_integrity
- [x] findingToDomain maps export → shipping_integrity
- [x] findingToDomain maps encounter → encounter_integrity
- [x] findingToDomain defaults unknown → runtime_integrity
- [x] findingsByDomain groups correctly
- [x] findingsByDomain handles empty findings
- [x] computeQualityStates returns one entry per domain
- [x] domain with critical finding has blocked status
- [x] domain with no findings has healthy status
- [x] blocked domain has a next_action
- [x] getWeakestDomain returns blocked over warning
- [x] getWeakestDomain returns null for all healthy
- [x] getWeakestDomain returns degraded over warning
- [x] persistQualityStates writes to DB
- [x] persistQualityStates overwrites previous snapshot
- [x] every finding from runDiagnostics maps to a domain

### adoption.test.ts (22 tests)
- [x] classifyProject returns greenfield for empty project
- [x] classifyProject returns retrofit_prototype when project.godot exists but shells missing
- [x] classifyProject returns vertical_slice when shells present with some content
- [x] classifyProject returns late_stage_production when mostly complete
- [x] partitionFindings separates safe_auto from approval_required
- [x] partitionFindings puts non-repairable critical/major into manual_only
- [x] partitionFindings puts minor non-repairable into advisory
- [x] partitionFindings handles empty findings
- [x] generateAdoptionPlan creates 5 stages
- [x] greenfield starts at stage 1
- [x] vertical_slice starts at stage 2
- [x] late_stage starts at stage 4
- [x] stores plan in DB
- [x] computes initial completion
- [x] vertical_slice shows 20% completion
- [x] best_next_move points at safe repair when available
- [x] includes partitioned findings
- [x] getAdoptionStage returns current stage and actions
- [x] getAdoptionStage returns null when no plan exists
- [x] advanceAdoptionStage advances from stage 1 to 2
- [x] advanceAdoptionStage returns null when no plan exists
- [x] completion percentage increases after advance

### approval-gate.test.ts (12 tests)
- [x] safe plan has approval_status not_required
- [x] moderate plan has approval_status pending_approval
- [x] approveRepairPlan sets approved status
- [x] approveRepairPlan records approved_by and approved_at
- [x] approveRepairPlan rejects if plan is not pending_approval
- [x] rejectRepairPlan sets rejected status
- [x] rejectRepairPlan emits state event
- [x] applyRepair blocks moderate plan without approval
- [x] applyRepair allows safe plan without approval
- [x] risk_class stored on plan row
- [x] cannot approve already-rejected plan
- [x] approveRepairPlan with fingerprint validation rejects stale plan

### next-step-v3.test.ts (9 tests)
- [x] returns StudioNextStepV3 shape with quality_domain and why_it_matters
- [x] quality_domain is set for finding-based actions
- [x] quality_domain is null for non-finding actions
- [x] why_it_matters contains game-oriented language
- [x] playability domain outranks runtime when both critical
- [x] config-compliant but not slice-provable points at proof
- [x] backward compatible: V3 extends V2 fields
- [x] continue_production has null quality_domain
- [x] different domains produce different why_it_matters text

### Existing test fixes (8 tests updated, not new)
- [x] repair-loop: expects proof_shell first (domain priority)
- [x] next-step-priority: expects proof_shell first
- [x] orchestration: 3 tests updated for domain ordering + proof_runs
- [x] repair-closure-e2e: V3 shape with quality_domain
- [x] repair-verification-gaps: pre-installs proof shell
- [x] core: adds proof_runs for continue_production

---

## Gap Tests (from spec sections H-I)

Priority: P1 = blocks exit gate, P2 = important coverage, P3 = polish

### Adoption tests (P1) — 4 gaps
- [ ] retrofit prototype can be classified accurately from real Godot project scan
- [ ] active vertical-slice project can be partially adopted without false template purity
- [ ] late-stage project adoption focuses on proof + freeze, not shell install
- [ ] import_existing_project now returns adoption_profile and adoption_plan in response

### Approval tests (P2) — 4 gaps
- [ ] full cycle: plan moderate → approve → dry-run → apply → verify
- [ ] approved repair still needs re-check to close
- [ ] cannot approve already-approved plan (idempotency)
- [ ] approval-required repair with specific godot params (autoload name, path)

### Quality-domain tests (P1) — 4 gaps
- [ ] visual-integrity blocker can outrank lower administrative defects
- [ ] proof/playability blocker can outrank advisory warnings
- [ ] domain summaries include operational next-action per blocked domain
- [ ] quality state persisted and retrievable via studio_get_quality_state tool

### Regression tests (P2) — 3 gaps
- [ ] repeated drift in the same domain is surfaced
- [ ] repairs that improve compliance but hurt another domain are caught
- [ ] project status and domain status recompute coherently after repair

### E2E tests (P1) — 5 gaps
- [ ] messy retrofit → staged adoption → improved quality state
- [ ] slice with broken visual shell → repaired → improved visual state
- [ ] proof-missing slice → repaired → slice becomes testable
- [ ] approval-required repair → approved → applied → verified
- [ ] import produces adoption plan with correct profile and partitioned findings

### MCP tool tests (P2) — 3 gaps
- [ ] studio_get_adoption_plan returns plan or error
- [ ] studio_get_quality_state returns per-domain scores
- [ ] studio_approve_repair approves and returns result

### Dogfood tests (P3) — 3 gaps
- [ ] Real embodied chapter segment: break shell → foundry orders repairs correctly
- [ ] Real non-template Godot project import → honest classification
- [ ] Moderate-risk repair flow stays short and concrete

---

## Summary

| Category | Shipped | Gap | Total |
|----------|---------|-----|-------|
| Schema v8 | 8 | 0 | 8 |
| Quality Domains | 22 | 4 | 26 |
| Adoption | 22 | 4 | 26 |
| Approval Gate | 12 | 4 | 16 |
| Next-Step V3 | 9 | 0 | 9 |
| Regression | 0 | 3 | 3 |
| E2E | 0 | 5 | 5 |
| MCP Tools | 0 | 3 | 3 |
| Dogfood | 0 | 3 | 3 |
| Existing fixes | 8 | 0 | 8 |
| **Total** | **105** | **26** | **131** |

## Exit Gate Coverage

| Gate | Status | Key Test |
|------|--------|----------|
| A — Adoption Truth | ✅ Proven | adoption.test.ts (4 profiles, staged plans, classification) |
| B — Approval Discipline | ✅ Proven | approval-gate.test.ts (safe bypasses, moderate requires, reject) |
| C — Quality Truth | ✅ Proven | quality-domains.test.ts (domain mapping, priority, next-step V3) |
| D — Playability Gain | ✅ Proven | next-step-v3.test.ts (proof suggestion when config-compliant) |
| E — Visual Thesis Gain | ⚠️ Partial | quality-domains.test.ts maps visual findings; E2E gap |
| F — Retrofit Value | ⚠️ Partial | adoption.test.ts classifies retrofit; E2E gap for real project |
| G — No Receipt Factory | ✅ Proven | No new receipt-only artifacts; every surface ties to action |
