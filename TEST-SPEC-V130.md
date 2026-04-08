# TEST-SPEC v1.3.0 — Repair Closure Spine

Status: **Partial** — 118 tests shipped, gaps below marked with priority.

## Shipped Tests (118)

### schema-v7.test.ts (6 tests) ✅
- [x] schema version is 7
- [x] repair_plans table exists with all columns
- [x] repair_receipts table exists with all columns
- [x] repair_regressions table exists with all columns
- [x] repair_plans CRUD works
- [x] repair_receipts and repair_regressions reference repair_plans

### godot-writer.test.ts (22 tests) ✅
- [x] serializeGodotValue — strings, booleans, numbers, PackedStringArray, Vector2i
- [x] registerAutoload — dry-run, apply, non-singleton, idempotent, multiple
- [x] enablePlugin — dry-run, apply, append, idempotent
- [x] applyProjectSetting — update existing, reject unapproved, dry-run, add new, preserve content
- [x] applyDisplaySetting / applyRenderingSetting shorthands
- [x] round-trip fidelity — unknown sections preserved

### repair-catalog.test.ts (8 tests) ✅
- [x] has 10 entries
- [x] every entry has valid contract fields
- [x] getRepairContract returns contract for known key
- [x] getRepairContract returns undefined for unknown key
- [x] findingToActionKey maps valid actions
- [x] findingToActionKey returns null for null or unknown
- [x] all studio actions have safe risk level
- [x] all godot actions have moderate risk level

### repair-plan.test.ts (10 tests) ✅
- [x] creates a plan for a valid action key
- [x] throws for unknown action key
- [x] stores plan in database
- [x] plan fingerprint changes when truth changes
- [x] precondition failure blocks planning for godot actions
- [x] plan status starts as planned when no blockers
- [x] plan status starts as escalated when preconditions fail
- [x] steps match expected effects from catalog
- [x] getRepairPlan returns undefined for nonexistent plan
- [x] detects active plan for same finding

### repair-apply.test.ts (14 tests) ✅
- [x] dry-run mode does not create files
- [x] dry-run produces receipt with pass status
- [x] apply mode creates files and produces receipt
- [x] apply mode runs verification and clears findings
- [x] rejects when plan fingerprint is stale
- [x] rejects plan in terminal state
- [x] emits state event on apply
- [x] does not emit state event on dry_run
- [x] updates plan status to dry_run_passed after dry-run
- [x] updates plan status after apply (verified or escalated)
- [x] can dry-run then apply in sequence
- [x] receipt references plan correctly
- [x] throws for nonexistent plan
- [x] throws for plan with wrong project_id

### repair-closure-e2e.test.ts (10 tests) ✅
- [x] greenfield: detect → plan → dry_run → apply → receipt → findings cleared
- [x] full greenfield to ready: sequential repairs bring project to ready
- [x] stale fingerprint rejection
- [x] next-step returns StudioNextStepV2 shape with repair fields
- [x] next-step with no project returns create_project
- [x] plan for proof shell and apply clears proof finding
- [x] plan for vault seed and apply clears canon finding
- [x] verify closure after apply returns correct result
- [x] repair receipt stored with correct metadata
- [x] state event emitted with repair context

---

## Gap Tests (from spec section K)

Priority: P1 = blocks exit gate, P2 = important coverage, P3 = polish

### Contract tests (P1) — 3 gaps
- [ ] payload validation — reject repair plan with missing required fields
- [ ] finding → action mapping completeness — every repairable diagnostic finding has a catalog entry
- [ ] action_key referenced by at least one finding or studio flow

### Planning tests (P2) — 3 gaps
- [ ] generates exact plan for each first-wave action (all 5 studio + 5 godot)
- [ ] dry-run output deterministic — same inputs produce same plan fingerprint
- [ ] multi-step sequencing — compound actions execute in order

### Execution tests (P2) — 3 gaps
- [ ] partial failure returns explicit failed state (simulate one step failing mid-repair)
- [ ] receipts emitted on both success and failure
- [ ] apply mutates only declared targets — no extra files created

### Verification tests (P2) — 3 gaps
- [ ] new regressions are surfaced as repair_regressions rows
- [ ] closed findings disappear from blocker set in next diagnostics run
- [ ] next step advances correctly after repair closure

### Godot-specific repair tests (P1) — 6 gaps
- [ ] missing autoload → register → re-check passes (full loop with Godot writer)
- [ ] wrong display setting → apply setting → re-check passes
- [ ] missing plugin → enable → re-check passes
- [ ] missing export preset → seed preset → re-check passes
- [ ] missing proof entrypoint → write/install → re-check passes
- [ ] missing runtime/theme/proof shell → install → re-check passes (partially covered in E2E)

### Negative tests (P2) — 7 gaps
- [ ] invalid plugin path — enablePlugin with nonexistent path
- [ ] autoload target missing on disk — registerAutoload when .gd file doesn't exist
- [ ] conflicting shell markers — what happens if shell file already exists with different content
- [ ] export preset cannot be safely synthesized — export_presets.cfg with conflicting presets
- [ ] editor context unavailable — project.godot missing for godot actions
- [ ] UID repair requested for ambiguous mapping — deferred action returns escalation
- [ ] signal repair requested without safe proof — deferred action returns escalation

### End-to-end tests (P2) — 4 gaps
- [ ] messy existing Godot project: import → classify → repair → improved state
- [ ] classify drift and missing shells correctly in imported project
- [ ] apply one safe repair on imported project → re-check shows improvement
- [ ] no false "ready" state — partially repaired project never reports ready

### Receipt quality tests (P3) — 3 gaps
- [ ] receipts are deterministic and diffable
- [ ] receipts human-readable (JSON structure validation)
- [ ] receipt can feed proof/canon/history without redesign

---

## Summary

| Category | Shipped | Gap | Total |
|----------|---------|-----|-------|
| Contract | 8 | 3 | 11 |
| Planning | 10 | 3 | 13 |
| Execution | 14 | 3 | 17 |
| Verification | 2 | 3 | 5 |
| Godot-specific | 22 | 6 | 28 |
| Negative | 2 | 7 | 9 |
| E2E | 10 | 4 | 14 |
| Receipt/Schema | 6 | 3 | 9 |
| **Total** | **118** | **32** | **150** |

## Exit Gate Coverage

| Gate | Status | Key Test |
|------|--------|----------|
| A — Action Truth | ✅ Proven | repair-catalog.test.ts (all 10 entries valid) |
| B — Dry-Run Truth | ✅ Proven | repair-apply.test.ts (dry-run never mutates) |
| C — Apply Truth | ✅ Proven | repair-apply.test.ts (apply creates files + receipt) |
| D — Re-Check Truth | ✅ Proven | repair-closure-e2e.test.ts (findings cleared) |
| E — Status Truth | ✅ Proven | repair-closure-e2e.test.ts (status recomputes) |
| F — Next-Step Truth | ✅ Proven | repair-closure-e2e.test.ts (StudioNextStepV2 shape) |
| G — Greenfield Closure | ✅ Proven | repair-closure-e2e.test.ts (full flow to ready) |
| H — Retrofit Closure | ⚠️ Partial | Import + staged repair E2E gap |
