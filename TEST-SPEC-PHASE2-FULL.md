# Game Foundry OS — Phase 2 Full Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 287 tests passing across 40 files
**Goal:** Fill all Phase 2 gaps. Target: ~370 tests.

## What's Covered (do NOT duplicate)

- `encounter-doctrine-core/tests/core.test.ts` (24 tests): state machine basics, roster CRUD, rules, structural/dependency validation, next-step (3 states), timeline, chapter matrix
- `encounter-doctrine-mcp/tests/tools.test.ts` (6 tests): Phase 0 inspection tools (validateBounds, validateFormation, exportManifest)
- `encounter-doctrine-mcp/tests/encounter-register.test.ts` (4 tests): Phase 0 registerEncounter
- `encounter-doctrine-mcp/tests/export-edge.test.ts` (3 tests): buildManifest helper
- `encounter-doctrine-mcp/tests/tool-handlers.test.ts` (7+ tests): Phase 0 validation + listing

## Critical Gaps

1. **6 core functions have ZERO tests:** exportManifest, getExports, getCanonicalExport, syncToEngine, getSyncReceipts, diffManifestVsRuntime
2. **15 MCP doctrine tool handlers have ZERO tests**
3. **State machine only tests 2 of 12 transitions**
4. **No end-to-end workflow test**

## Rules

- `vitest`, `openDatabase(':memory:')`, schema v3 auto-runs
- `fs.mkdtempSync` for filesystem tests, clean up in `afterEach`
- Do NOT modify existing source or test files
- Build first: `npx tsc -p packages/registry/tsconfig.json && npx tsc -p packages/encounter-doctrine-core/tsconfig.json`
- Import from `@mcptoolshop/encounter-doctrine-core` and `@mcptoolshop/game-foundry-registry`

## Seed Pattern

```typescript
import { openDatabase, upsertProject, upsertCharacter, upsertVariant, upsertPack } from '@mcptoolshop/game-foundry-registry';

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test', tmpDir);
  // encounters table now has production_state (default 'draft')
  // encounter_enemies now has role_tag, team, spawn_group, facing, engine_profile_json
});
```

---

## Tests to Write

### 1. `packages/encounter-doctrine-core/tests/state-machine-full.test.ts` (8 tests)

```
describe('encounter state machine — full transition coverage')
  it('draft → intent_defined')
  it('intent_defined → roster_defined')
  it('roster_defined → formation_defined')
  it('formation_defined → rules_defined')
  it('rules_defined → validated_structural')
  it('validated_structural → dependencies_resolved')
  it('dependencies_resolved → manifest_exported')
  it('full 12-state lifecycle chain from draft to frozen')
```

Walk through every transition using `transitionEncounterState`. Each test verifies the state_events row is written and production_state is updated.

---

### 2. `packages/encounter-doctrine-core/tests/export.test.ts` (6 tests)

**CRITICAL — these 3 functions have zero coverage.**

```
describe('exportManifest')
  it('creates manifest JSON file at target path')
  it('manifest includes roster, rules, arena, and encounter metadata')
  it('records encounter_exports row with content_hash')
  it('getExports returns export history')
  it('getCanonicalExport returns latest canonical export')
  it('repeated exports both recorded, latest is canonical')
```

Setup: Create encounter with units and rules. Use `fs.mkdtempSync` for output dir. Call `exportManifest(db, encounterId, projectRoot, targetPath)`. Read the written file and verify JSON structure.

---

### 3. `packages/encounter-doctrine-core/tests/sync.test.ts` (5 tests)

**CRITICAL — these 2 functions have zero coverage.**

```
describe('syncToEngine')
  it('copies manifest to target runtime path')
  it('creates encounter_sync_receipts row')
  it('receipt has correct encounter_id and target_path')
  it('getSyncReceipts returns sync history')
  it('verification_status defaults to unverified')
```

Setup: Write a manifest file first (via exportManifest or manually), then call `syncToEngine`. Use `fs.mkdtempSync`.

---

### 4. `packages/encounter-doctrine-core/tests/diff.test.ts` (5 tests)

**CRITICAL — this function has zero coverage.**

```
describe('diffManifestVsRuntime')
  it('returns match when runtime file hash equals canonical export hash')
  it('returns mismatch when runtime file content differs')
  it('returns missing when runtime file does not exist')
  it('returns no_export when no canonical export exists for encounter')
  it('handles encounter with export but no runtime path gracefully')
```

Setup: Create encounter, export manifest, copy to runtime path (or modify it), then call `diffManifestVsRuntime`. Use `fs.mkdtempSync`.

---

### 5. `packages/encounter-doctrine-core/tests/roster-edge.test.ts` (5 tests)

```
describe('roster edge cases')
  it('addUnit with all optional fields populated (engine_profile_json, spawn_group, facing)')
  it('moveUnit updates only specified fields, preserves others')
  it('getUnits returns empty array for encounter with no units')
  it('addUnit with character_id field')
  it('multiple units at same position (no auto-validation in roster layer)')
```

---

### 6. `packages/encounter-doctrine-core/tests/validation-edge.test.ts` (6 tests)

```
describe('validation edge cases')
  it('structural validation fails for unit at negative coordinates')
  it('structural validation passes with unit at grid boundary (row=2, col=7 on 3x8)')
  it('structural validation fails when encounter has zero enemy-team units')
  it('dependency validation fails when phase2 variant in rule does not exist')
  it('dependency validation reports ALL missing dependencies in one call')
  it('getValidationHistory returns runs in chronological order')
```

---

### 7. `packages/encounter-doctrine-core/tests/next-step-full.test.ts` (7 tests)

```
describe('encounter next-step — all states')
  it('draft → suggests define_intent')
  it('intent_defined → suggests add_unit')
  it('roster_defined → suggests validate_structural')
  it('rules_defined → suggests validate_structural')
  it('validated_structural → suggests validate_dependencies')
  it('dependencies_resolved → suggests export_manifest')
  it('manifest_exported → suggests sync_to_engine')
```

---

### 8. `packages/encounter-doctrine-core/tests/timeline-edge.test.ts` (4 tests)

```
describe('timeline edge cases')
  it('empty encounter returns empty timeline')
  it('timeline includes validation runs with pass/fail details')
  it('timeline entries are sorted by timestamp')
  it('getChapterMatrix returns empty array for chapter with no encounters')
```

---

### 9. `packages/encounter-doctrine-mcp/tests/doctrine-workflow.test.ts` (12 tests)

**End-to-end lifecycle using core functions — the most important test file.**

```
describe('full encounter doctrine workflow')
  it('creates encounter in draft state')
  it('defines intent → transitions to intent_defined')
  it('adds 3 units → can advance to roster_defined')
  it('adds rule (phase_transition) → can advance to rules_defined')
  it('structural validation passes → transitions to validated_structural')
  it('dependency validation passes → transitions to dependencies_resolved')
  it('exports manifest → transitions to manifest_exported, file written')
  it('syncs to engine → transitions to engine_synced, receipt created')
  it('diff shows match after sync')
  it('clone creates copy with same roster and rules')
  it('remove_unit decreases count')
  it('get_next_step returns correct action at each stage')
```

Setup: Use `fs.mkdtempSync`. Seed project, characters, variants, packs. Walk through the entire lifecycle.

---

### 10. `packages/encounter-doctrine-mcp/tests/doctrine-clone.test.ts` (4 tests)

```
describe('doctrine clone')
  it('clones encounter with same arena dimensions')
  it('clones all units with positions preserved')
  it('clones all rules')
  it('cloned encounter starts in draft state')
```

---

### 11. `packages/encounter-doctrine-mcp/tests/chapter-matrix-full.test.ts` (4 tests)

```
describe('chapter matrix')
  it('returns all encounters for a chapter with production states')
  it('includes validation status per encounter')
  it('filters by project_id')
  it('returns empty for nonexistent chapter')
```

---

### 12. `packages/registry/tests/schema-v3.test.ts` (6 tests)

```
describe('schema migration v3')
  it('schema version is 3')
  it('encounters table has production_state column')
  it('encounters table has encounter_type column defaulting to standard')
  it('encounter_enemies table has role_tag and team columns')
  it('encounter_rules table exists with rule_type and rule_key columns')
  it('encounter_validation_runs table exists')
```

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `encounter-doctrine-core/tests/state-machine-full.test.ts` | 8 | High |
| `encounter-doctrine-core/tests/export.test.ts` | 6 | **Critical** |
| `encounter-doctrine-core/tests/sync.test.ts` | 5 | **Critical** |
| `encounter-doctrine-core/tests/diff.test.ts` | 5 | **Critical** |
| `encounter-doctrine-core/tests/roster-edge.test.ts` | 5 | Medium |
| `encounter-doctrine-core/tests/validation-edge.test.ts` | 6 | High |
| `encounter-doctrine-core/tests/next-step-full.test.ts` | 7 | High |
| `encounter-doctrine-core/tests/timeline-edge.test.ts` | 4 | Medium |
| `encounter-doctrine-mcp/tests/doctrine-workflow.test.ts` | 12 | **Critical** |
| `encounter-doctrine-mcp/tests/doctrine-clone.test.ts` | 4 | Medium |
| `encounter-doctrine-mcp/tests/chapter-matrix-full.test.ts` | 4 | Medium |
| `registry/tests/schema-v3.test.ts` | 6 | Medium |
| **Total** | **72** | |

**Target after completion:** 359 tests (287 existing + 72 new)

## Source Modification

None required.
