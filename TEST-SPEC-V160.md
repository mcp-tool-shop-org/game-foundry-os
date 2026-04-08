# TEST-SPEC v1.6.0 — Chapter Spine

Status: **Complete** — 58 new tests shipped (1122 → 1180), all hard gates proven, 8 MCP tools wired.

## What v1.6.0 Proves

Game Foundry OS can now answer: **"Is Chapter 1 shippable?"** — by aggregating encounter readiness, battle scene readiness, proof coverage, playtest results, and quality domain health into one decisive chapter-level verdict.

---

## Shipped Tests (58 new, 1180 total)

### schema-v10.test.ts (6 tests) — registry
- [x] schema version is 10
- [x] chapters table exists with all columns
- [x] chapter_health_snapshots table exists with all columns
- [x] chapters CRUD works
- [x] chapter_health_snapshots CRUD works
- [x] chapter indexes exist

### chapter-contract.test.ts (15 tests) — chapter-spine-core
- [x] creates chapter with correct fields
- [x] accepts optional fields (sort_order, intent, requirements)
- [x] upserts on conflict
- [x] getChapter returns by id
- [x] getChapter returns undefined for nonexistent
- [x] listChapters returns ordered by sort_order
- [x] listChapters returns empty for project with no chapters
- [x] getChapterEncounters returns encounters in the chapter
- [x] getChapterEncounters returns empty for chapter with no encounters
- [x] getChapterEncounters infers project_id from chapter record
- [x] transitions from draft to encounters_ready
- [x] emits state event on transition
- [x] rejects backward transitions
- [x] supports full forward chain to frozen
- [x] throws for nonexistent chapter

### chapter-health.test.ts (14 tests) — chapter-spine-core
- [x] getEncounterCoverageMap returns empty for no encounters
- [x] marks encounter without scene contract
- [x] marks encounter with full battle scene setup
- [x] counts major findings for encounter with missing contract
- [x] returns incomplete for chapter with no encounters
- [x] returns incomplete for chapter with encounter missing scene contract
- [x] returns ready when all encounters fully satisfied
- [x] surfaces exact blocker encounter by name
- [x] playtest failure degrades chapter health when required
- [x] persists health snapshot to DB
- [x] includes encounter coverage in snapshot
- [x] weakest domain propagated from encounter findings
- [x] throws for nonexistent chapter
- [x] handles multiple encounters with mixed states

### chapter-next-step.test.ts (7 tests) — chapter-spine-core
- [x] empty chapter → create_encounter
- [x] chapter with encounter missing scene contract → battle_create_scene_contract
- [x] chapter with all encounters satisfied → continue_production
- [x] playtest failure surfaces as chapter risk
- [x] targets worst encounter in multi-encounter chapter
- [x] includes why_it_matters from domain
- [x] throws for nonexistent chapter

### chapter-playtest.test.ts (7 tests) — chapter-spine-core
- [x] returns untested for chapter with no encounters
- [x] returns incomplete when some encounters untested
- [x] returns pass when all encounters pass
- [x] fail verdict propagates from single encounter
- [x] marginal when no fails but some marginal
- [x] counts total read failures across encounters
- [x] throws for nonexistent chapter

### e2e-v160.test.ts (9 tests) — chapter-spine-core
- [x] chapter with all encounters passing = ready (hard gate 1)
- [x] names the blocking encounter when one is missing (hard gate 2)
- [x] coverage map shows per-encounter detail (hard gate 2)
- [x] failing playtest blocks chapter when required (hard gate 3)
- [x] playtest aggregation shows overall chapter verdict (hard gate 3)
- [x] tiny sprites → chapter blocked (hard gate 4)
- [x] next-step points to worst encounter with exact action (hard gate 5)
- [x] continue_production when all healthy (hard gate 5)
- [x] 3 encounters, 1 failing proof → names it (hard gate 5)

---

## Summary

| Category | Tests |
|----------|-------|
| Schema v10 | 6 |
| Chapter Contract | 15 |
| Chapter Health | 14 |
| Chapter Next-Step | 7 |
| Chapter Playtest | 7 |
| E2E (hard gates) | 9 |
| **Total new** | **58** |

## Hard Gate Coverage

| Gate | Status | Key Test |
|------|--------|----------|
| 1 — "Is Chapter 1 shippable?" | ✅ Proven | e2e: ch1 with 2 passing encounters → ready |
| 2 — Exact blockers by encounter | ✅ Proven | e2e: blocker_summary names "Raider Ambush" |
| 3 — Playtest failures degrade chapter | ✅ Proven | e2e: fail verdict propagates, chapter not ready |
| 4 — Presentation failures = chapter risk | ✅ Proven | e2e: tiny sprites → chapter blocked |
| 5 — Next-step = highest-value move | ✅ Proven | e2e: targets enc3 Boss Fight, critical priority |

## MCP Tools (8 new, 130 total)

| Tool | Description |
|------|-------------|
| `chapter_create` | Create/register a chapter |
| `chapter_get_health` | Chapter health across all domains |
| `chapter_get_coverage_map` | Per-encounter coverage |
| `chapter_get_next_step` | Best next move for the chapter |
| `chapter_get_playtest_status` | Aggregated playtest bundle |
| `chapter_list` | List chapters with health |
| `chapter_run_full_proof` | Run proof for entire chapter |
| `chapter_get_timeline` | Events across chapter encounters |
