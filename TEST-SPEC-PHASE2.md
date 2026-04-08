# Game Foundry OS — Phase 2 Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 287 tests passing across 40 files
**Goal:** Fill Phase 2 coverage gaps. Target: ~360 tests.

## Rules for the Implementing Agent

- Use `vitest` (already configured)
- Use `openDatabase(':memory:')` — schema v3 runs automatically
- Do NOT modify existing source or test files
- Seed data in `beforeEach` using registry functions
- For filesystem tests, use `fs.mkdtempSync` and clean up in `afterEach`
- Build packages first: `npx tsc -p packages/registry/tsconfig.json && npx tsc -p packages/encounter-doctrine-core/tsconfig.json && npx tsc -p packages/encounter-doctrine-mcp/tsconfig.json`
- Import core functions from `@mcptoolshop/encounter-doctrine-core`
- Import registry functions from `@mcptoolshop/game-foundry-registry`

## Tests to Write

### 1. `packages/encounter-doctrine-core/tests/state-machine-edge.test.ts` (6 tests)

```
describe('encounter state machine edge cases')
  it('ENCOUNTER_PRODUCTION_STATES has exactly 12 entries')
  it('every state except frozen has at least one forward transition')
  it('frozen has no forward transitions')
  it('transition with explicit projectId uses it')
  it('rejects backward transition roster_defined → draft')
  it('full lifecycle chain works through all 12 states')
```

---

### 2. `packages/encounter-doctrine-core/tests/roster-edge.test.ts` (6 tests)

```
describe('roster edge cases')
  it('addUnit with all optional fields populated')
  it('moveUnit only updates specified fields, preserves others')
  it('removeUnit actually deletes the row')
  it('getUnits returns empty array for encounter with no units')
  it('getUnitCount returns 0 for empty encounter')
  it('addUnit with engine_profile_json stores JSON correctly')
```

---

### 3. `packages/encounter-doctrine-core/tests/rules-edge.test.ts` (5 tests)

```
describe('rules edge cases')
  it('attaches multiple rules to same encounter')
  it('attaches phase_transition rule with payload')
  it('removeRule does not affect other rules')
  it('getRules returns empty array for no rules')
  it('rule_payload_json is stored and retrieved as string')
```

---

### 4. `packages/encounter-doctrine-core/tests/validation-edge.test.ts` (8 tests)

```
describe('structural validation edge cases')
  it('fails when a unit is at negative row/col')
  it('fails when encounter has no enemy-team units')
  it('passes with exactly one unit at grid boundary')
  it('getValidationHistory returns multiple runs in order')

describe('dependency validation edge cases')
  it('fails when phase2 variant referenced in rule does not exist')
  it('passes when all variants and packs exist')
  it('reports multiple missing dependencies in one call')
  it('writes validation run entry on each call')
```

---

### 5. `packages/encounter-doctrine-core/tests/export-edge.test.ts` (5 tests)

```
describe('export edge cases')
  it('creates manifest file at target path')
  it('manifest JSON includes all roster units with positions')
  it('manifest includes rules')
  it('getCanonicalExport returns latest canonical export')
  it('repeated exports both recorded in history')
```

Uses `fs.mkdtempSync` for file output.

---

### 6. `packages/encounter-doctrine-core/tests/sync-edge.test.ts` (4 tests)

```
describe('sync edge cases')
  it('copies manifest to target runtime path')
  it('creates sync receipt with correct fields')
  it('getSyncReceipts returns history')
  it('verification_status defaults to unverified')
```

Uses `fs.mkdtempSync`.

---

### 7. `packages/encounter-doctrine-core/tests/diff.test.ts` (4 tests)

```
describe('diffManifestVsRuntime')
  it('returns match when runtime file matches canonical export hash')
  it('returns mismatch when runtime file differs')
  it('returns missing when runtime file does not exist')
  it('returns no_export when no canonical export exists')
```

Uses `fs.mkdtempSync`.

---

### 8. `packages/encounter-doctrine-core/tests/next-step-edge.test.ts` (6 tests)

```
describe('encounter next-step edge cases')
  it('draft encounter suggests define_intent')
  it('intent_defined suggests add_unit')
  it('roster_defined suggests validate_structural')
  it('validated_structural suggests validate_dependencies')
  it('dependencies_resolved suggests export_manifest')
  it('manifest_exported suggests sync_to_engine')
```

---

### 9. `packages/encounter-doctrine-core/tests/timeline-edge.test.ts` (4 tests)

```
describe('encounter timeline edge cases')
  it('empty encounter returns empty timeline')
  it('timeline includes state events and validation runs')
  it('timeline is sorted chronologically')
  it('getChapterMatrix returns encounters grouped correctly')
```

---

### 10. `packages/encounter-doctrine-mcp/tests/doctrine-workflow.test.ts` (10 tests)

**End-to-end workflow using core functions.**

```
describe('full encounter workflow through core functions')
  it('creates encounter in draft state')
  it('defines intent → state becomes intent_defined')
  it('adds 3 units → state becomes roster_defined')
  it('structural validation passes → state becomes validated_structural')
  it('dependency validation passes → state becomes dependencies_resolved')
  it('export creates manifest file → state becomes manifest_exported')
  it('sync copies to runtime → state becomes engine_synced')
  it('clone creates copy with same roster and rules')
  it('remove_unit decreases unit count')
  it('get_next_step returns correct action at each stage')
```

Uses temp dirs for export/sync filesystem operations.

---

### 11. `packages/encounter-doctrine-mcp/tests/doctrine-tools.test.ts` (8 tests)

**Test individual MCP tool logic (not wrappers, the operations they perform).**

```
describe('doctrine tool operations')
  it('doctrine_create sets production_state to draft')
  it('doctrine_add_unit populates role_tag and team fields')
  it('doctrine_move_unit updates row/col without affecting other fields')
  it('doctrine_attach_rule stores rule_payload_json')
  it('doctrine_validate_structural writes validation_run history')
  it('doctrine_validate_dependencies detects missing variant')
  it('doctrine_export_manifest records content_hash')
  it('doctrine_clone preserves units and rules in new encounter')
```

---

### 12. `packages/encounter-doctrine-mcp/tests/chapter-matrix.test.ts` (4 tests)

```
describe('chapter matrix')
  it('returns all encounters for a chapter')
  it('includes production_state for each encounter')
  it('includes validation status for each encounter')
  it('returns empty for chapter with no encounters')
```

---

### 13. `packages/registry/tests/schema-v3.test.ts` (6 tests)

```
describe('schema migration v3')
  it('encounters table has production_state column')
  it('encounters table has encounter_type column')
  it('encounter_enemies table has role_tag column')
  it('encounter_rules table exists')
  it('encounter_exports table exists')
  it('encounter_validation_runs table exists')
```

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `encounter-doctrine-core/tests/state-machine-edge.test.ts` | 6 | High |
| `encounter-doctrine-core/tests/roster-edge.test.ts` | 6 | High |
| `encounter-doctrine-core/tests/rules-edge.test.ts` | 5 | Medium |
| `encounter-doctrine-core/tests/validation-edge.test.ts` | 8 | **Critical** |
| `encounter-doctrine-core/tests/export-edge.test.ts` | 5 | High |
| `encounter-doctrine-core/tests/sync-edge.test.ts` | 4 | High |
| `encounter-doctrine-core/tests/diff.test.ts` | 4 | High |
| `encounter-doctrine-core/tests/next-step-edge.test.ts` | 6 | High |
| `encounter-doctrine-core/tests/timeline-edge.test.ts` | 4 | Medium |
| `encounter-doctrine-mcp/tests/doctrine-workflow.test.ts` | 10 | **Critical** |
| `encounter-doctrine-mcp/tests/doctrine-tools.test.ts` | 8 | **Critical** |
| `encounter-doctrine-mcp/tests/chapter-matrix.test.ts` | 4 | Medium |
| `registry/tests/schema-v3.test.ts` | 6 | Medium |
| **Total** | **76** | |

**Target after completion:** 363 tests (287 existing + 76 new)

## Source Modification

None required. All tests use core functions and registry functions directly.
