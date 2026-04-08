# TEST-SPEC v1.7.0 — Playable Chapter Loop

Status: **Complete** — 33 new tests shipped (1180 → 1213), all hard gates proven.

## What v1.7.0 Proves

Game Foundry OS can now close the loop from production truth to playable proof: **one entrypoint runs all proofs, produces a decisive verdict, generates a handoff artifact, and gates freeze promotion.**

---

## Shipped Tests (33 new, 1213 total)

### chapter-prove.test.ts (10 tests)
- [x] returns complete prove result for chapter with encounters
- [x] scene_proofs includes proof result for each encounter with contract
- [x] scene_proofs has null proof for encounter without contract
- [x] blocker_count includes missing contracts as blockers
- [x] blocker_count aggregates failures across all scene proofs
- [x] playtest_status reflects aggregated verdicts
- [x] handles empty chapter
- [x] throws for nonexistent chapter
- [x] warning_count aggregates from all scene proofs
- [x] runs proofs for multiple encounters independently

### chapter-verdict.test.ts (8 tests)
- [x] playable verdict for fully satisfied chapter
- [x] incomplete verdict when encounter has no scene contract
- [x] blocked verdict when scene proof fails
- [x] blocked verdict when playtest fails and required
- [x] incomplete verdict for empty chapter
- [x] verdict_reason names the specific blocking encounter and assertion
- [x] persists verdict to chapter_verdicts table
- [x] includes full prove bundle

### chapter-freeze.test.ts (6 tests)
- [x] playable chapter → can freeze, risk clear
- [x] blocked chapter → cannot freeze
- [x] incomplete chapter → cannot freeze
- [x] empty chapter → cannot freeze
- [x] blockers include encounter and domain details
- [x] throws for nonexistent chapter

### e2e-v170.test.ts (9 tests)
- [x] **Hard gate 1**: ch1 with 3 encounters → prove → verdict = playable → handoff → freeze = ready
- [x] **Hard gate 2**: single prove call produces health + scene proofs + playtest
- [x] **Hard gate 3a**: failed scene proof → verdict = blocked
- [x] **Hard gate 3b**: failed playtest → verdict = blocked when required
- [x] **Hard gate 4a**: verdict names blocking encounter and domain
- [x] **Hard gate 4b**: handoff what_failed lists the specific encounter
- [x] **Hard gate 5a**: handoff includes everything needed to continue
- [x] **Hard gate 5b**: handoff persists to handoff_artifacts table
- [x] **Hard gate 5c**: freeze calibration gates blocked chapter

---

## Hard Gate Coverage

| Gate | Status | Key Test |
|------|--------|----------|
| 1 — Produce playable artifact | ✅ Proven | e2e: 3 encounters → prove → playable → handoff → freeze ready |
| 2 — Prove bundle from one entrypoint | ✅ Proven | e2e: single call returns health + proofs + playtest |
| 3 — Failed proof/playtest blocks verdict | ✅ Proven | e2e: tiny sprites → blocked; failed playtest → blocked |
| 4 — Names exact blocker | ✅ Proven | e2e: verdict names "Hard Ambush", domain = presentation |
| 5 — Handoff strong enough | ✅ Proven | e2e: artifact has what_built/passed/failed/blocking/next_move |
