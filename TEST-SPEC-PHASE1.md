# Game Foundry OS — Phase 1 Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 178 tests passing across 25 files
**Goal:** Fill Phase 1 coverage gaps. Target: ~260 tests.

## What's Well-Covered (do NOT duplicate)

- **sprite-foundry-core** (35 tests): 100% export coverage — state machine, batches, picks, artifacts, next-step, timeline
- **Engine bridge utilities** (57 tests): godot.ts, verifyRuntimePaths, reportPlaceholders, reportUnintegrated, getBattleRuntimeStatus, syncSpritePack
- **Registry models** (32 tests): All CRUD, validation, freeze log
- **Bootstrap** (21 tests): TFR seeding, helpers

## What's NOT Covered — the gap

**33 MCP tool handler functions have ZERO test coverage.** The underlying core/utility functions are tested, but the MCP wrappers (argument validation, error responses, database state changes, response format) are not.

## Rules for the Implementing Agent

- Use `vitest` (already configured)
- Use `openDatabase(':memory:')` for all tests — schema v2 runs automatically
- Do NOT modify existing source or test files
- Seed data in `beforeEach` using registry functions (`upsertProject`, `upsertCharacter`, `upsertVariant`)
- New variants from schema v2 have `production_state='draft'` by default
- For filesystem tests, use `fs.mkdtempSync` and clean up in `afterEach`
- Run `npx vitest run` from repo root to verify all pass
- Build packages first: `npx tsc -p packages/registry/tsconfig.json && npx tsc -p packages/sprite-foundry-core/tsconfig.json && npx tsc -p packages/sprite-foundry-mcp/tsconfig.json`
- Import core functions from `@mcptoolshop/sprite-foundry-core`
- Import registry functions from `@mcptoolshop/game-foundry-registry`

---

## Tests to Write

### 1. `packages/sprite-foundry-mcp/tests/workflow-lifecycle.test.ts` (12 tests)

**End-to-end lifecycle tests using core functions directly (not MCP wrappers).**

```
describe('full variant lifecycle through core functions')
  it('creates variant in draft state')
  it('starts concept batch → state becomes concept_batch_started')
  it('records concept candidates → state becomes concept_candidates_recorded')
  it('locks concept pick → state becomes concept_locked + artifact registered')
  it('starts directional batch → creates 5 batch records, state becomes directional_batch_started')
  it('locking 4 of 5 directions does NOT advance state')
  it('locking all 5 directions advances to directional_locked')
  it('assembles sheet → state becomes sheet_assembled + 3 artifacts registered')
  it('slices pack → state becomes pack_sliced + 8 pack_member artifacts')
  it('syncs to engine → state becomes engine_synced')
  it('full lifecycle produces correct timeline with all event types')
  it('next_step returns correct action at each stage')
```

Setup: Create project + character + variant. Walk through entire lifecycle using `transitionState`, `createBatch`, `lockPick`, `registerArtifact`, `getNextStep`, `getVariantTimeline`.

---

### 2. `packages/sprite-foundry-mcp/tests/tool-createVariant.test.ts` (5 tests)

**Test the `foundryCreateVariant.ts` tool handler logic.**

Read the tool file first to understand its exact behavior, then test:

```
describe('create_variant tool')
  it('creates character and variant when character does not exist')
  it('creates variant under existing character')
  it('sets production_state to draft')
  it('sets display_name and runtime_variant_name on variant')
  it('returns error for missing project_id')
```

Approach: Since MCP tool handlers are registered as closures, test by importing the tool file's exported function and calling it with a mock server, OR by directly calling the underlying logic. The simplest pattern: import the register function, create a real McpServer, register the tool, then check DB state after.

**Alternative simpler approach:** Just test the logic the tool performs by replicating its steps with core + registry functions. The tool is a thin wrapper — test the integration it performs.

---

### 3. `packages/sprite-foundry-mcp/tests/tool-conceptFlow.test.ts` (8 tests)

```
describe('concept flow tools')
  describe('start_concept_batch')
    it('creates batch record with correct variant_id and batch_type')
    it('transitions variant from draft to concept_batch_started')
    it('rejects if variant is not in draft state')

  describe('record_concept_candidates')
    it('registers artifacts for each candidate file')
    it('updates batch status to recorded')
    it('transitions to concept_candidates_recorded')

  describe('lock_concept_pick')
    it('creates locked pick + concept_locked artifact')
    it('transitions to concept_locked')
```

---

### 4. `packages/sprite-foundry-mcp/tests/tool-directionalFlow.test.ts` (8 tests)

```
describe('directional flow tools')
  describe('start_directional_batch')
    it('creates one batch per direction (5 batches)')
    it('transitions to directional_batch_started')
    it('uses custom directions array when provided')

  describe('lock_directional_pick')
    it('locks one direction and reports completion matrix')
    it('does not advance state with partial locks (3 of 5)')
    it('auto-advances to directional_locked when all 5 locked')
    it('registers directional_locked artifact for each lock')
    it('upserts if same direction locked twice')
```

---

### 5. `packages/sprite-foundry-mcp/tests/tool-sheetAndPack.test.ts` (6 tests)

```
describe('sheet and pack tools')
  describe('assemble_sheet')
    it('registers sheet + preview + silhouette artifacts')
    it('transitions to sheet_assembled')
    it('rejects if not all directional locks exist')

  describe('slice_pack')
    it('registers pack_member artifact for each direction file')
    it('transitions to pack_sliced')
    it('with engine_sync=true, also transitions to engine_synced')
```

---

### 6. `packages/sprite-foundry-mcp/tests/tool-syncAndPortrait.test.ts` (5 tests)

```
describe('sync and portrait tools')
  describe('sync_pack_to_engine')
    it('copies files from source to target directory')
    it('registers sync_receipt artifact')
    it('transitions to engine_synced')

  describe('attach_portrait_set')
    it('registers portrait artifacts with size metadata')
    it('updates variant portrait_state to attached')
```

Uses `fs.mkdtempSync` for filesystem operations.

---

### 7. `packages/sprite-foundry-mcp/tests/tool-queryTools.test.ts` (4 tests)

```
describe('query tools')
  describe('get_next_step')
    it('returns correct next action for draft variant')
    it('returns missing directional locks for directional_batch_started')

  describe('get_character_timeline')
    it('returns merged timeline across multiple variants')
    it('returns empty timeline for character with no events')
```

---

### 8. `packages/sprite-foundry-core/tests/state-machine-edge.test.ts` (5 tests)

```
describe('state machine edge cases')
  it('PRODUCTION_STATES has exactly 11 entries')
  it('every state except frozen has at least one allowed transition')
  it('frozen has no forward transitions')
  it('transition with explicit projectId uses it instead of looking up')
  it('transition writes payload_json when provided')
```

---

### 9. `packages/sprite-foundry-core/tests/next-step-edge.test.ts` (5 tests)

```
describe('next-step edge cases')
  it('sheet_assembled with no sheet artifact reports missing artifact')
  it('pack_sliced with fewer than 8 pack_members reports count')
  it('engine_synced with portrait_state=none suggests portrait attachment')
  it('engine_synced with portrait_state=attached suggests proof')
  it('directional_batch_started with all locks reports state inconsistency')
```

---

### 10. `packages/sprite-foundry-core/tests/artifacts-edge.test.ts` (4 tests)

```
describe('artifact edge cases')
  it('registers artifact with is_canonical=false')
  it('getCanonicalArtifact ignores non-canonical artifacts')
  it('getCanonicalArtifact with direction filter returns correct artifact')
  it('computeFileHash returns consistent hash for same content')
```

Uses `fs.mkdtempSync` for hash tests.

---

### 11. `packages/encounter-doctrine-mcp/tests/tool-handlers.test.ts` (7 tests)

```
describe('encounter-doctrine tool handlers')
  it('validate_bounds returns pass for valid encounter')
  it('validate_bounds returns fail with violation details')
  it('validate_formation detects overlapping positions')
  it('validate_variants detects missing variant references')
  it('list_encounters filters by project and chapter')
  it('get_encounter returns encounter with enemies')
  it('register_encounter creates encounter and replaces enemies on re-register')
```

These test the registry functions that the MCP tools wrap. Seed with `upsertProject`, `upsertCharacter`, `upsertVariant`, `upsertPack`, `upsertEncounter`, `addEnemy`.

---

### 12. `packages/engine-bridge-mcp/tests/sync-encounter-full.test.ts` (4 tests)

```
describe('syncEncounterManifest')
  it('creates output directory and writes JSON file')
  it('manifest contains correct encounter structure with enemies')
  it('enemy engine_data is parsed from JSON string to object')
  it('throws for nonexistent encounter_id')
```

Uses `fs.mkdtempSync`. Seeds encounter + enemies in DB.

---

### 13. `packages/game-foundry-mcp/tests/unified-phase1.test.ts` (3 tests)

```
describe('unified server with Phase 1 tools')
  it('registers all 33 tools (8 inspection + 12 workflow + 7 encounter + 6 engine)')
  it('all tools have unique names (no duplicates)')
  it('tool names follow expected naming conventions')
```

Import `createServer` from each domain package. Count registered tools. The unified index.js can't be imported directly (it calls `await server.connect()`), so test each domain's server.ts separately and sum.

---

### 14. `packages/registry/tests/schema-v2.test.ts` (5 tests)

```
describe('schema migration v2')
  it('creates foundry_batches table')
  it('creates locked_picks table')
  it('creates artifacts table')
  it('creates state_events table')
  it('variants table has production_state column defaulting to draft')
```

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `sprite-foundry-mcp/tests/workflow-lifecycle.test.ts` | 12 | **Critical** |
| `sprite-foundry-mcp/tests/tool-createVariant.test.ts` | 5 | High |
| `sprite-foundry-mcp/tests/tool-conceptFlow.test.ts` | 8 | **Critical** |
| `sprite-foundry-mcp/tests/tool-directionalFlow.test.ts` | 8 | **Critical** |
| `sprite-foundry-mcp/tests/tool-sheetAndPack.test.ts` | 6 | High |
| `sprite-foundry-mcp/tests/tool-syncAndPortrait.test.ts` | 5 | High |
| `sprite-foundry-mcp/tests/tool-queryTools.test.ts` | 4 | Medium |
| `sprite-foundry-core/tests/state-machine-edge.test.ts` | 5 | Medium |
| `sprite-foundry-core/tests/next-step-edge.test.ts` | 5 | High |
| `sprite-foundry-core/tests/artifacts-edge.test.ts` | 4 | Medium |
| `encounter-doctrine-mcp/tests/tool-handlers.test.ts` | 7 | Medium |
| `engine-bridge-mcp/tests/sync-encounter-full.test.ts` | 4 | High |
| `game-foundry-mcp/tests/unified-phase1.test.ts` | 3 | Medium |
| `registry/tests/schema-v2.test.ts` | 5 | Medium |
| **Total** | **81** | |

**Target after completion:** 259 tests (178 existing + 81 new)

## Source Modification

None required. All tests use core functions and registry functions directly.

## Key Imports for Test Files

```typescript
// Registry
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';

// Core
import {
  transitionState, canTransition, getProductionState, getStateEvents, PRODUCTION_STATES,
  createBatch, getBatch, listBatches, updateBatchStatus,
  lockPick, getLockedPicks, hasAllDirectionalLocks,
  registerArtifact, getArtifacts, getCanonicalArtifact, computeFileHash,
  getNextStep,
  getVariantTimeline, getCharacterTimeline,
} from '@mcptoolshop/sprite-foundry-core';
```
