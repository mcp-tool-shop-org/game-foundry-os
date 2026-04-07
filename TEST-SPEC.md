# Game Foundry OS — Comprehensive Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 93 tests passing across 13 files
**Goal:** Fill all coverage gaps. Target: ~140 tests.

## Rules for the Implementing Agent

- Use `vitest` (already configured)
- Use `openDatabase(':memory:')` for unit tests
- Use `fs.mkdtempSync` for tests that need temp directories, clean up in `afterEach`
- Bootstrap integration tests point at real `F:/AI/the-fractured-road`
- Do NOT modify existing source or test files
- Run `npx vitest run` from repo root to verify everything passes
- Each test file should be self-contained with its own setup

## Existing Coverage (93 tests — do NOT duplicate)

| File | Tests | Covers |
|------|-------|--------|
| `registry/tests/registry.test.ts` | 20 | Schema, projects, characters, variants, encounters, validation, freeze |
| `registry/tests/pack.test.ts` | 4 | listPacks, updatePackCounts |
| `registry/tests/freeze.test.ts` | 3 | getLatestFreeze |
| `registry/tests/encounter-edge.test.ts` | 5 | clearEnemies, listEncounters filters, empty encounter |
| `sprite-foundry-mcp/tests/tools.test.ts` | 10 | validateCompleteness, scanAssets |
| `sprite-foundry-mcp/tests/paths.test.ts` | 5 | Path utilities |
| `sprite-foundry-mcp/tests/completeness-edge.test.ts` | 4 | Edge cases for completeness checks |
| `encounter-doctrine-mcp/tests/tools.test.ts` | 6 | validateBounds, validateFormation, exportManifest |
| `encounter-doctrine-mcp/tests/encounter-register.test.ts` | 4 | Register encounter logic |
| `encounter-doctrine-mcp/tests/export-edge.test.ts` | 3 | Export manifest edge cases |
| `engine-bridge-mcp/tests/bridge.test.ts` | 17 | Godot utils, verify, placeholders, unintegrated, status, sync |
| `bootstrap/tests/bootstrap.test.ts` | 8 | TFR integration (project, characters, encounters, validation) |
| `bootstrap/tests/helpers.test.ts` | 4 | Observable helper behavior through bootstrap output |

---

## Tests to Write

### 1. `packages/engine-bridge-mcp/tests/sync-encounter.test.ts` (5 tests)

**CRITICAL — `syncEncounterManifest()` is completely untested.**

```
describe('syncEncounterManifest')
  it('creates output directory and writes valid JSON file')
  it('manifest contains correct encounter_id, chapter, label, grid, enemies')
  it('enemy entries include parsed engine_data as object, not string')
  it('throws for nonexistent project_id')
  it('throws for nonexistent encounter_id')
```

Setup: `openDatabase(':memory:')`, seed project + encounter + enemies. Use temp dir as project root. Import `syncEncounterManifest` from `../src/tools/syncEncounterManifests.js`. Verify file written to `{root}/assets/data/encounters/{id}.json`. Parse and assert JSON structure.

---

### 2. `packages/engine-bridge-mcp/tests/verify-edge.test.ts` (5 tests)

```
describe('verifyRuntimePaths edge cases')
  it('throws for nonexistent project_id')
  it('handles character with no variants gracefully')
  it('skips portrait-type variants')
  it('reports missing .import files separately from missing PNGs')
  it('detects portrait presence for characters that have portraits')
```

Setup: Temp dir with selective file creation. Seed registry with characters that have varying completeness.

---

### 3. `packages/engine-bridge-mcp/tests/placeholders-edge.test.ts` (4 tests)

```
describe('reportPlaceholders edge cases')
  it('throws for nonexistent project_id')
  it('reports variant with no pack_id as placeholder with reason')
  it('does not count portrait-type variants')
  it('empty project returns 0 placeholders and 0 total_checked')
```

---

### 4. `packages/engine-bridge-mcp/tests/unintegrated-edge.test.ts` (4 tests)

```
describe('reportUnintegrated edge cases')
  it('throws for nonexistent project_id')
  it('ignores characters where pack_status is not complete')
  it('reports multiple simultaneous gaps (PNGs + imports + integration_status)')
  it('reports variant with pack_status=complete but no pack_id assigned')
```

---

### 5. `packages/engine-bridge-mcp/tests/status-edge.test.ts` (6 tests)

```
describe('getBattleRuntimeStatus edge cases')
  it('throws for nonexistent project_id')
  it('empty project returns zero counts and overall_ready=true')
  it('boss with phase1 and phase2 both on disk reports both ok')
  it('boss with phase1 ok but phase2 missing reports phase2_ok=false')
  it('overall_ready is false when any encounter fails bounds validation')
  it('portraits.missing includes enemy characters too')
```

---

### 6. `packages/engine-bridge-mcp/tests/sync-pack-edge.test.ts` (5 tests)

```
describe('syncSpritePack edge cases')
  it('throws when project not found')
  it('throws when character not found')
  it('throws when variant not found')
  it('throws when directional source directory does not exist')
  it('skips foundry dirs that have no PNGs and adds SKIP to receipt')
```

Setup: Temp dirs with partial or missing directional structures. Verify receipt messages.

---

### 7. `packages/engine-bridge-mcp/tests/godot-edge.test.ts` (4 tests)

```
describe('godot utility edge cases')
  it('packAlbedoDir produces correct path segments')
  it('directionalSourceDir produces correct path segments')
  it('portraitPath lowercases character name')
  it('checkDirectionalSource returns 0 for nonexistent character')
```

Pure function tests, no DB needed.

---

### 8. `packages/engine-bridge-mcp/tests/integration.test.ts` (5 tests)

**Integration tests against real TFR filesystem. Requires bootstrap to have been run.**

```
describe('engine bridge integration with The Fractured Road')
  it('verifyRuntimePaths finds all 18 variants with 8/8 PNGs and imports')
  it('reportPlaceholders returns 0 placeholders')
  it('getBattleRuntimeStatus shows 6/6 party complete')
  it('getBattleRuntimeStatus shows 7/7 encounters passing all validation')
  it('portraits.missing includes Drift, Wynn, Vael, Thresh')
```

Setup: `openDatabase()` (real DB, already seeded). Import tool functions directly. Point at `F:/AI/the-fractured-road`.

---

### 9. `packages/bootstrap/tests/bootstrap-edge.test.ts` (4 tests)

```
describe('bootstrap edge cases')
  it('is idempotent — running twice produces same character/variant counts')
  it('handles project root with no manifest.json gracefully')
  it('handles project root with no directional sprites gracefully')
  it('freeze_log entry is created with correct object_type and notes')
```

Setup: Temp dirs with minimal or empty structures, plus one run against real TFR.

---

### 10. `packages/bootstrap/tests/helpers-direct.test.ts` (5 tests)

**Export the helpers from scan-tfr.ts first** (add `export` to `formatName`, `countPackDirections`, `countDirectionalDirs`, `deriveProductionStates`), then test directly:

```
describe('bootstrap helper functions')
  it('formatName converts riot_husk to Riot Husk')
  it('formatName converts single word to capitalized')
  it('countPackDirections returns 0 for nonexistent directory')
  it('countDirectionalDirs returns 5 when all dirs present')
  it('deriveProductionStates sets concept_status=complete when concept PNGs exist')
```

**NOTE:** This requires adding `export` keyword to 4 helper functions in `scan-tfr.ts`. This is the ONE source modification allowed for this spec.

---

### 11. `packages/game-foundry-mcp/tests/unified.test.ts` (3 tests)

**Integration test for the unified server host.**

```
describe('unified game-foundry-mcp server')
  it('loads and registers all 21 tools from 3 domains')
  it('all tools share the same database instance')
  it('server name is game-foundry-mcp version 0.1.0')
```

Setup: Dynamic import of `../index.js` (need to mock StdioServerTransport to prevent stdin binding). OR import `createServer` from each domain package and verify tool counts. If direct import is too complex, test by running `node index.js` in a subprocess and checking tool list via MCP protocol.

**Alternative simpler approach if subprocess is too complex:**
```
describe('unified server tool registration')
  it('sprite-foundry-mcp server.ts registers 8 tools')
  it('encounter-doctrine-mcp server.ts registers 7 tools')
  it('engine-bridge-mcp server.ts registers 6 tools')
```

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `engine-bridge-mcp/tests/sync-encounter.test.ts` | 5 | **Critical** |
| `engine-bridge-mcp/tests/verify-edge.test.ts` | 5 | High |
| `engine-bridge-mcp/tests/placeholders-edge.test.ts` | 4 | High |
| `engine-bridge-mcp/tests/unintegrated-edge.test.ts` | 4 | High |
| `engine-bridge-mcp/tests/status-edge.test.ts` | 6 | High |
| `engine-bridge-mcp/tests/sync-pack-edge.test.ts` | 5 | High |
| `engine-bridge-mcp/tests/godot-edge.test.ts` | 4 | Medium |
| `engine-bridge-mcp/tests/integration.test.ts` | 5 | **Critical** |
| `bootstrap/tests/bootstrap-edge.test.ts` | 4 | Medium |
| `bootstrap/tests/helpers-direct.test.ts` | 5 | Medium |
| `game-foundry-mcp/tests/unified.test.ts` | 3 | Medium |
| **Total** | **50** | |

**Target after completion:** 143 tests (93 existing + 50 new)

## Source Modification Required

One source file needs minimal modification to enable direct helper testing:

**File:** `packages/bootstrap/src/scan-tfr.ts`
**Change:** Add `export` keyword to these 4 functions (currently internal):
- `formatName` (line ~324)
- `countPackDirections` (line ~328)
- `countDirectionalDirs` (line ~335)
- `deriveProductionStates` (line ~342)

This is the only source change allowed. Everything else is test-only additions.
