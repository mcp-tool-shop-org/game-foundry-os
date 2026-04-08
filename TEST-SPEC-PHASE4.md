# Game Foundry OS — Phase 4 Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 498 tests passing across 67 files
**Goal:** Fill Phase 4 gaps. Target: ~560 tests.

## What's Covered (40 tests in canon-core/tests/core.test.ts)

- Frontmatter parsing (valid, missing, arrays, empty) — 4 tests
- Vault sync (register, update, invalid, nested) — 4 tests
- Pages (get, list, search, status update) — 4 tests
- Links (character, encounter, getLinks, getLinksTo) — 4 tests
- Snapshots (create, list, compare) — 3 tests
- Drift detection (clean, variant mismatch, encounter mismatch) — 3 tests
- Handoff generation (content, disk write, artifact row) — 3 tests
- Next-step (no pages, unlinked, drift) — 3 tests
- Timeline (chronological, drift reports) — 2 tests
- Plus ~10 additional tests from the agent build

## Tests to Write

### 1. `packages/canon-core/tests/vault-edge.test.ts` (5 tests)

```
describe('vault sync edge cases')
  it('ignores non-.md files in vault')
  it('handles vault with no .md files gracefully')
  it('detects content hash change on resync')
  it('creates snapshot on each sync')
  it('handles deeply nested directory structure')
```

Uses `fs.mkdtempSync` with test vault directories.

---

### 2. `packages/canon-core/tests/frontmatter-edge.test.ts` (5 tests)

```
describe('frontmatter parsing edge cases')
  it('handles multiline values')
  it('handles inline arrays [a, b, c]')
  it('handles boolean values true/false')
  it('handles numeric values')
  it('handles quoted strings with colons')
```

---

### 3. `packages/canon-core/tests/links-edge.test.ts` (4 tests)

```
describe('canon links edge cases')
  it('one page can link to multiple targets')
  it('unlinkObject removes only the specified link')
  it('linking promotes page status from registered to linked')
  it('getLinksTo returns all pages that link to a target')
```

---

### 4. `packages/canon-core/tests/drift-edge.test.ts` (5 tests)

```
describe('drift detection edge cases')
  it('chapter drift when encounter count mismatches')
  it('drift writes canon_drift_reports row')
  it('clean result when canon matches production')
  it('warning result for non-critical mismatch')
  it('handles missing canon page gracefully')
```

---

### 5. `packages/canon-core/tests/handoff-edge.test.ts` (4 tests)

```
describe('handoff edge cases')
  it('handoff includes canon page content summary')
  it('handoff includes production state for linked objects')
  it('handoff includes proof/freeze status when available')
  it('missing linked data is reported as debt in handoff')
```

---

### 6. `packages/canon-core/tests/snapshots-edge.test.ts` (3 tests)

```
describe('snapshot edge cases')
  it('compareSnapshots identifies added frontmatter keys')
  it('compareSnapshots identifies removed frontmatter keys')
  it('compareSnapshots identifies changed values')
```

---

### 7. `packages/canon-mcp/tests/canon-workflow.test.ts` (10 tests)

**End-to-end canon workflow.**

```
describe('full canon workflow')
  it('syncs vault and registers pages')
  it('validates pages and reports missing frontmatter')
  it('links character page to variant')
  it('links encounter page to encounter')
  it('gets character bible with production state')
  it('gets encounter intent with manifest state')
  it('detects drift between canon and production')
  it('generates handoff artifact')
  it('creates page stub with valid frontmatter')
  it('get_next_step reports unlinked pages')
```

Uses `fs.mkdtempSync` for test vault.

---

### 8. `packages/canon-mcp/tests/canon-search.test.ts` (3 tests)

```
describe('canon search')
  it('finds pages by title text')
  it('filters by kind')
  it('returns empty for no matches')
```

---

### 9. `packages/canon-core/tests/project-matrix.test.ts` (3 tests)

```
describe('canon project matrix')
  it('returns coverage across all chapters')
  it('includes linked vs unlinked page counts')
  it('includes drift status per chapter')
```

---

### 10. `packages/registry/tests/schema-v5.test.ts` (5 tests)

```
describe('schema migration v5')
  it('canon_pages table exists with canon_id unique constraint')
  it('canon_links table exists with source_canon_id column')
  it('canon_snapshots table exists')
  it('canon_drift_reports table exists')
  it('handoff_artifacts table exists with artifact_type column')
```

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `canon-core/tests/vault-edge.test.ts` | 5 | High |
| `canon-core/tests/frontmatter-edge.test.ts` | 5 | High |
| `canon-core/tests/links-edge.test.ts` | 4 | Medium |
| `canon-core/tests/drift-edge.test.ts` | 5 | **Critical** |
| `canon-core/tests/handoff-edge.test.ts` | 4 | High |
| `canon-core/tests/snapshots-edge.test.ts` | 3 | Medium |
| `canon-mcp/tests/canon-workflow.test.ts` | 10 | **Critical** |
| `canon-mcp/tests/canon-search.test.ts` | 3 | Medium |
| `canon-core/tests/project-matrix.test.ts` | 3 | Medium |
| `registry/tests/schema-v5.test.ts` | 5 | Medium |
| **Total** | **47** | |

**Target after completion:** 545 tests (498 existing + 47 new)

## Rules

- `vitest`, `openDatabase(':memory:')`, schema v5 auto-runs
- `fs.mkdtempSync` for vault/filesystem tests
- Create test .md files with `---` frontmatter blocks
- Do NOT modify existing source or test files
- Import from `@mcptoolshop/canon-core` and `@mcptoolshop/game-foundry-registry`
