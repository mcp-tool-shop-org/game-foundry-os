Phase 3 — Proof Lab + Freeze Orchestration Spec
Purpose

Turn "done" into a system operation.

Phase 0 made the project inspectable. Phase 1 made sprite production a real workflow. Phase 2 made encounter production a real workflow. Phase 3 closes the loop:

Assets, encounters, runtime, and chapters can be proved, scored for freeze readiness, and promoted to frozen through one truthful system.

This phase is where Game Foundry OS stops being only a production-control system and becomes a trust system.

Phase 3 outcome

At the end of Phase 3, you should be able to ask:

Is Chapter 1 actually freeze-ready?
What debt is blocking avar_boss from proof-complete status?
Which variants are engine-synced but unproved?
Which encounters are runtime-synced but still fail presentation readiness?
What changed between the last freeze candidate and the current chapter state?
Can the system generate a freeze report for a chapter or project without human archaeology?

And get authoritative answers from MCP.

You should also be able to:

run proof suites
record proof results as immutable receipts
compute freeze readiness mechanically
freeze a candidate only when doctrine allows it
Scope
In scope
proof run registry
proof suite definitions
result receipts
asset/encounter/runtime/chapter proof categories
freeze readiness scoring / gating
freeze candidate generation
freeze promotion / demotion
regression tracking
debt reporting
next-step intelligence for proof blockers
project / chapter freeze reports
Out of scope for Phase 3
full design/canon integration from Obsidian
visual storyboard tooling
generalized CI dashboards
portfolio-wide scheduling/orchestration beyond proof queries
final publishing/distribution workflow

Phase 3 is about trust and readiness, not external release management.

Core doctrine
Unit of proof

Proof operates at four main levels:

Variant proof Example: riot_husk, avar_armed, bell_warden
Encounter proof Example: goblin_opener, bell_warden_micro, avar_boss
Runtime proof Example: battle runtime resolution, placeholder absence, variant/path integrity
Chapter proof Example: Chapter 1 as a whole, including required assets, encounters, runtime integrity, and declared freeze rules
Freeze is earned, not declared

A chapter or asset cannot become frozen because somebody feels done. It becomes frozen only when:

required proof suites pass
blocking debt is zero
runtime truth is clean
declared freeze criteria are met
a freeze receipt is created
Proof must be receipted

A green terminal is not enough. Every proof run must write a durable result object that the system can reason about later.

Lifecycle model
Proofable entity states

Proof is a parallel trust track on top of production state.

Variant proof states
unproved
proof_pending
proof_pass
proof_fail
freeze_candidate
frozen
Encounter proof states
unproved
proof_pending
proof_pass
proof_fail
freeze_candidate
frozen
Chapter proof states
unproved
proof_pending
partial_pass
proof_pass
freeze_candidate
frozen
frozen_with_debt (optional, explicit, never silent)
Key rule

Production completion is not proof completion.

Examples:

a variant can be engine_synced but still unproved
an encounter can be engine_synced but proof_fail
a chapter can be content-complete but not freeze-ready
Registry schema additions
1. proof_suites

Defines proof suite types and scope.

Fields:

id
project_id
suite_key
scope_type (variant, encounter, runtime, chapter, project)
display_name
description
is_blocking
created_at

Examples:

asset_integrity
pack_integrity
encounter_integrity
runtime_integrity
chapter_spine
presentation_readiness
2. proof_runs

Canonical run records.

Fields:

id
project_id
suite_id
scope_type
scope_id
result (pass, fail, partial)
blocking_failures
warning_count
receipt_hash
summary
details_json
tool_name
created_at
3. proof_assertions

Optional granular assertion rows for richer traceability.

Fields:

id
proof_run_id
assertion_key
status (pass, fail, warn, skip)
message
details_json
created_at
4. freeze_policies

Project/chapter freeze requirements.

Fields:

id
project_id
scope_type (chapter, project, variant, encounter)
scope_id
policy_key
policy_json
created_at

Examples:

Chapter 1 requires all encounter proofs pass
portraits may be warning-only, not freeze-blocking
placeholders are always blocking
boss runtime integrity is blocking
5. freeze_candidates

Computed or emitted freeze-candidate records.

Fields:

id
project_id
scope_type
scope_id
status (candidate, blocked, promoted, revoked)
blocking_reasons_json
warning_reasons_json
candidate_hash
created_at
6. freeze_receipts

Immutable freeze promotion records.

Fields:

id
project_id
scope_type
scope_id
source_candidate_id
receipt_hash
freeze_summary
details_json
created_at
7. regressions

Tracks proof regressions after prior pass/freeze.

Fields:

id
project_id
scope_type
scope_id
regression_type
from_run_id
to_run_id
severity
details_json
created_at
8. state_events

Reuse existing event log with:

entity_type = proof_run
entity_type = freeze_candidate
entity_type = chapter / variant / encounter proof-state changes
Proof suite doctrine
1. Asset integrity suite

Scope: variant / pack / chapter

Checks:

required artifacts exist
canonical ownership is clean
dimensions correct
pack completeness correct
engine sync receipt exists if required
runtime paths resolve if required
2. Encounter integrity suite

Scope: encounter / chapter

Checks:

structural validation pass exists
dependency validation pass exists
export exists
engine sync receipt exists if required
runtime manifest matches canonical export if applicable
3. Runtime integrity suite

Scope: project / chapter / encounter

Checks:

placeholders absent
runtime paths resolve
phase variants resolve
expected packs exist in runtime
runtime manifest drift absent
4. Chapter spine suite

Scope: chapter

Checks:

required encounter set present
required asset set present
runtime integrity clean
project-specific proving harness pass imported or recorded
chapter-level declared doctrine satisfied
5. Presentation readiness suite

Scope: chapter / encounter

This is intentionally lighter than final polish, but it gives the system a place to track user-visible debt.

Possible checks:

portraits complete or explicitly waived
battle UI shell state known
no placeholder art
boss framing requirements met if declared
required presentation debt list attached

This suite can support warning-only debt if doctrine allows it.

Freeze doctrine
Freeze policy examples
Chapter 1 freeze policy

Blocking:

no placeholders
all required encounters pass encounter integrity
runtime integrity pass
chapter spine pass
boss phase runtime integrity pass

Warning-only:

portraits missing for non-critical enemies
presentation debt tagged but accepted only if policy allows
Variant freeze policy

Blocking:

pack complete
engine synced
asset integrity pass

Optional:

portrait complete if variant requires portrait
No silent waivers

Any override must be explicit and recorded in:

freeze candidate
freeze receipt
state events
Phase 3 MCP tool set

Ship these first 12 tools.

1. proof.run_asset_suite
Purpose

Run asset integrity proof for a variant, character, or chapter.

Input
project_id
scope_type
scope_id
Output
proof run record
assertion summary
blocking/warning breakdown
next step if failed
2. proof.run_encounter_suite
Purpose

Run encounter integrity proof for an encounter or chapter.

Input
project_id
scope_type
scope_id
Output
proof run record
structural/dependency/export/sync truth
blockers
3. proof.run_runtime_suite
Purpose

Run runtime truth proof.

Input
project_id
scope_type
scope_id
Output
placeholder/path/variant/phase drift result
blockers and warnings
4. proof.run_chapter_spine
Purpose

Record or execute chapter-level proving.

Input
project_id
chapter_id
optional external result payload / harness command integration
Output
proof run record
chapter spine result
failure/blocker summary
5. proof.run_presentation_suite
Purpose

Track user-visible readiness debt without pretending polish is binary.

Input
project_id
scope_type
scope_id
Output
pass/partial/fail
blocking vs warning debt
recommended next action
6. proof.get_freeze_readiness
Purpose

Compute freeze readiness against policy.

Input
project_id
scope_type
scope_id
Output
readiness = ready / blocked / warning_only
blocking reasons
warning reasons
latest relevant proof runs
recommended next action

This is the central operator tool.

7. proof.freeze_candidate
Purpose

Create a freeze-candidate record from current truth.

Input
project_id
scope_type
scope_id
Behavior
snapshots readiness state
records blockers/warnings
emits candidate hash
Output
freeze candidate record
status = candidate or blocked
8. proof.promote_freeze
Purpose

Promote a valid candidate to frozen.

Input
project_id
candidate_id
optional override reason if policy allows
Behavior
verifies candidate is promotable
writes freeze receipt
updates entity proof/freeze state
emits state event
Output
freeze receipt
final status
9. proof.report_regressions
Purpose

Detect proof regressions between prior and current truth.

Input
project_id
scope_type
scope_id
Output
regression list
severity
impacted proofs
recommended next step
10. proof.get_timeline
Purpose

Show proof and freeze history over time.

Output
proof runs
candidate history
freeze promotions/revocations
regressions
11. proof.generate_freeze_report
Purpose

Produce a project/chapter/encounter freeze report artifact.

Input
project_id
scope_type
scope_id
output_path optional
Output
structured report
proof summary
readiness summary
debt summary
report artifact path/hash if emitted

This becomes the handoff-grade artifact.

12. proof.get_next_step
Purpose

Return exact blockers and recommended proof/freeze action.

Output
current proof state
missing suites
latest failed suites
missing policy conditions
recommended next action
Follow-up tools for Phase 3B
13. proof.revoke_freeze

Explicitly revoke frozen status on regression.

14. proof.compare_runs

Diff two proof runs or two freeze candidates.

15. proof.get_project_matrix

Project-wide truth view:

chapters
encounters
variants
proof states
freeze states
blockers
16. proof.attach_external_harness_result

For importing existing Godot proving harness outputs in a structured way.

State transition rules
Proof state transitions
unproved -> proof_pending
proof_pending -> proof_pass
proof_pending -> proof_fail
proof_pass -> freeze_candidate
freeze_candidate -> frozen
frozen -> proof_fail only via explicit regression/revocation path
Freeze transitions
blocked -> candidate only when blockers are cleared
candidate -> promoted only when policy passes
promoted -> revoked only via explicit regression/revocation record
Chapter-level rule

A chapter cannot become frozen unless all blocking policies pass, even if warning debt remains.

Next-step intelligence

proof.get_next_step(scope) should answer:

current proof state
latest relevant suite outcomes
blocking failures
warning debt
policy blockers
exact recommended next action
Example outputs
Example 1 — ch1
proof state: partial_pass
blockers: presentation_readiness fail, portraits debt marked blocking by chapter policy
next step: run_presentation_suite after portraits debt policy review
Example 2 — avar_boss
proof state: proof_fail
blockers: runtime_integrity failed due to missing phase variant sync
next step: engine sync avar_desperate, then rerun proof.run_runtime_suite
Example 3 — riot_husk
proof state: proof_pass
freeze readiness: ready
next step: freeze_candidate

This is where "done" becomes queryable instead of emotional.

Timeline behavior
proof.get_timeline(scope)

Should show:

all proof runs in order
suite outcomes over time
freeze candidate creation
freeze promotions
regressions
revocations
Why it matters

This is how you answer:

when did this chapter become freeze-ready?
what broke after it was green?
what changed between two freeze moments?
Sync with prior phases
Dependency on Phase 1

Phase 3 should consume:

variant production states
artifact registry
engine sync receipts
Dependency on Phase 2

Phase 3 should consume:

encounter production states
validation runs
canonical exports
encounter sync receipts
Dependency on engine bridge

Phase 3 should consume:

runtime path truth
placeholder reports
runtime variant resolution

Phase 3 should not re-invent those checks. It should orchestrate and receipt them.

Suggested repo/package shape
Keep modules separate internally
packages/game-foundry-registry
packages/proof-lab-core
packages/game-foundry-mcp
Recommended new split
proof-lab-core

Owns:

proof suite orchestration
freeze policy evaluation
candidate/freeze logic
regression detection
next-step logic
reporting
game-foundry-mcp

Owns:

tool registration
request validation
namespaced MCP interface

This mirrors Phases 1 and 2 and keeps doctrine logic testable.

Phase 3 test plan
Proof run tests
proof runs recorded correctly
assertion summaries stored
pass/fail/partial states computed correctly
suite scope handling works
Freeze readiness tests
blocking failures prevent readiness
warning-only debt does not block if policy allows
missing required suites block readiness
placeholder debt always blocks when policy says so
Freeze candidate tests
candidate hash created
blocker lists preserved
candidate status reflects readiness truth
stale candidate handling safe
Freeze promotion tests
promotion blocked when readiness is blocked
valid candidate promotes cleanly
freeze receipt created
state events emitted
Regression tests
newly failed suite after prior pass creates regression record
regression after freeze can trigger revoke path if policy requires
compare-runs logic identifies meaningful changes
Report tests
freeze report includes latest suite states
blocker/warning summaries accurate
chapter-level summary pulls correct assets/encounters/runtime truth
Real-world bootstrap tests

Use TFR examples:

riot_husk for variant proof
goblin_opener for standard encounter proof
avar_boss for boss/runtime proof
ch1 for chapter freeze readiness

These match the real production pain points.

Acceptance gates

Phase 3 is complete when all of these are true:

Gate A — proof receipts

Proof runs are durable, queryable, and tied to scope objects.

Gate B — freeze readiness truth

proof.get_freeze_readiness returns a trustworthy readiness answer with blockers and warnings.

Gate C — freeze promotion truth

The system can promote a valid candidate to frozen and generate a freeze receipt.

Gate D — regression truth

The system can detect when a previously green asset/encounter/chapter has regressed.

Gate E — report truth

The system can generate a freeze report artifact for at least one real chapter.

Gate F — TFR proving slice

Run one real TFR chapter through the full proof/freeze path and produce a valid freeze candidate or blocked report.

Strongest implementation order
Phase 3A

Ship first:

schema additions
proof.run_asset_suite
proof.run_encounter_suite
proof.run_runtime_suite
proof.get_freeze_readiness
proof.get_next_step

This gets the proof substrate real.

Phase 3B

Then: 7. proof.run_chapter_spine 8. proof.run_presentation_suite 9. proof.freeze_candidate 10. proof.generate_freeze_report 11. proof.get_timeline

This gets freeze candidate generation and reporting real.

Phase 3C

Then: 12. proof.promote_freeze 13. proof.report_regressions 14. proof.compare_runs 15. one full TFR chapter proof/freeze slice

This closes the promotion/regression loop.

Recommended first proving slice

Use one real chapter path as the first end-to-end proof.

Recommended sequence:

riot_husk — variant-level proof
goblin_opener — simple encounter proof
avar_boss — boss/runtime proof
ch1 — chapter freeze readiness + report

Why:

proves scope layers in ascending complexity
mirrors how the system will actually be used
pressure-tests the exact seams that mattered in TFR
Summary

Phase 3 is where Game Foundry OS makes trust mechanical:

proof runs are real
readiness is computed
debt is explicit
freeze is receipted
regressions are visible
handoff artifacts are system-generated

That is the phase where "done" finally stops meaning "I think so" and starts meaning the system can prove it.