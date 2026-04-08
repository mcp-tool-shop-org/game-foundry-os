# Game Foundry OS — Phase 3 Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 398 tests passing across 53 files
**Goal:** Fill Phase 3 gaps. Target: ~470 tests.

## What's Covered (39 tests in proof-lab-core/tests/core.test.ts)

- Proof run CRUD + receipt hash + assertions (5)
- Suite CRUD (2)
- Asset proof pass/fail + chapter scope (6)
- Encounter proof pass/fail (4)
- Freeze readiness ready/blocked/warning_only (3)
- Freeze candidate creation (2)
- Freeze promotion + rejection + receipt (4)
- Freeze revocation (1)
- Regression detection (4)
- Next-step (3)
- Timeline (2)
- Freeze report (3)

## Tests to Write

### 1. `packages/proof-lab-core/tests/runtime-proof.test.ts` (5 tests)

```
describe('runtime proof suite')
  it('passes when all variants have pack dirs with 8 PNGs on disk')
  it('fails when a variant pack dir is missing')
  it('fails when variant has fewer than 8 direction PNGs')
  it('creates assertions for each variant checked')
  it('chapter scope checks all variants in chapter')
```

Uses `fs.mkdtempSync` to create fake pack directories.

---

### 2. `packages/proof-lab-core/tests/presentation-proof.test.ts` (4 tests)

```
describe('presentation proof suite')
  it('passes when all party members have portraits')
  it('fails when party member portraits are missing')
  it('reports placeholder absence as a check')
  it('warning-only debt does not cause fail when policy allows')
```

---

### 3. `packages/proof-lab-core/tests/chapter-spine.test.ts` (5 tests)

```
describe('chapter spine proof')
  it('aggregates asset + encounter + runtime results')
  it('fails if any blocking sub-suite fails')
  it('passes when all sub-suites pass')
  it('records chapter-scope proof run with summary')
  it('includes encounter count and variant count in details')
```

---

### 4. `packages/proof-lab-core/tests/freeze-policy.test.ts` (5 tests)

```
describe('freeze policy evaluation')
  it('blocking policy prevents readiness when suite fails')
  it('non-blocking policy allows warning_only readiness')
  it('multiple policies evaluated together')
  it('missing required suite blocks readiness')
  it('all policies met returns ready')
```

---

### 5. `packages/proof-lab-core/tests/regression-edge.test.ts` (4 tests)

```
describe('regression edge cases')
  it('no regression when latest run is the first run')
  it('regression severity is critical by default')
  it('listRegressions filters by scope_type')
  it('regression after freeze triggers correct type')
```

---

### 6. `packages/proof-lab-core/tests/report-edge.test.ts` (4 tests)

```
describe('freeze report edge cases')
  it('report includes all suite types that have been run')
  it('report shows regression count when regressions exist')
  it('report for scope with no proof runs returns empty state')
  it('report includes debt summary with blocking vs warning counts')
```

---

### 7. `packages/proof-lab-core/tests/compare-runs.test.ts` (3 tests)

```
describe('compare proof runs')
  it('diffs two runs and identifies new failures')
  it('diffs two runs and identifies fixed assertions')
  it('returns empty diff for identical runs')
```

---

### 8. `packages/proof-lab-core/tests/project-matrix.test.ts` (4 tests)

```
describe('project matrix')
  it('returns all chapters with proof/freeze states')
  it('includes variant and encounter counts per chapter')
  it('shows freeze candidates and receipts')
  it('returns empty for project with no content')
```

---

### 9. `packages/proof-lab-mcp/tests/tool-suites.test.ts` (6 tests)

```
describe('proof MCP tool operations')
  it('proof_run_asset_suite creates run with assertions')
  it('proof_run_encounter_suite checks structural + dependency validation')
  it('proof_get_freeze_readiness returns correct status')
  it('proof_freeze_candidate creates candidate with correct status')
  it('proof_promote_freeze creates receipt and state event')
  it('proof_get_next_step returns recommended action')
```

Uses core functions directly (same pattern as Phase 1/2 tool tests).

---

### 10. `packages/proof-lab-mcp/tests/workflow.test.ts` (8 tests)

**End-to-end proof/freeze workflow.**

```
describe('full proof-to-freeze workflow')
  it('runs asset suite for variant → pass')
  it('runs encounter suite for encounter → pass')
  it('gets freeze readiness → ready')
  it('creates freeze candidate → status=candidate')
  it('promotes freeze → receipt created')
  it('detects regression when new run fails after freeze')
  it('revokes freeze on regression')
  it('generates freeze report with complete history')
```

---

### 11. `packages/proof-lab-core/tests/next-step-edge.test.ts` (4 tests)

```
describe('proof next-step edge cases')
  it('suggests run specific failed suite when one suite failed')
  it('suggests freeze_candidate after all suites pass')
  it('suggests promote_freeze when candidate exists')
  it('reports frozen when already frozen')
```

---

### 12. `packages/proof-lab-core/tests/timeline-edge.test.ts` (3 tests)

```
describe('proof timeline edge cases')
  it('includes regressions in timeline')
  it('includes freeze receipts in timeline')
  it('timeline sorted chronologically across event types')
```

---

### 13. `packages/registry/tests/schema-v4.test.ts` (5 tests)

```
describe('schema migration v4')
  it('proof_suites table exists with is_blocking column')
  it('proof_runs table exists with scope_type and scope_id')
  it('proof_assertions table exists')
  it('freeze_candidates table exists with status column')
  it('freeze_receipts table exists with source_candidate_id')
```

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `proof-lab-core/tests/runtime-proof.test.ts` | 5 | **Critical** |
| `proof-lab-core/tests/presentation-proof.test.ts` | 4 | High |
| `proof-lab-core/tests/chapter-spine.test.ts` | 5 | **Critical** |
| `proof-lab-core/tests/freeze-policy.test.ts` | 5 | **Critical** |
| `proof-lab-core/tests/regression-edge.test.ts` | 4 | High |
| `proof-lab-core/tests/report-edge.test.ts` | 4 | High |
| `proof-lab-core/tests/compare-runs.test.ts` | 3 | Medium |
| `proof-lab-core/tests/project-matrix.test.ts` | 4 | Medium |
| `proof-lab-mcp/tests/tool-suites.test.ts` | 6 | High |
| `proof-lab-mcp/tests/workflow.test.ts` | 8 | **Critical** |
| `proof-lab-core/tests/next-step-edge.test.ts` | 4 | Medium |
| `proof-lab-core/tests/timeline-edge.test.ts` | 3 | Medium |
| `registry/tests/schema-v4.test.ts` | 5 | Medium |
| **Total** | **60** | |

**Target after completion:** 458 tests (398 existing + 60 new)

## Rules

- `vitest`, `openDatabase(':memory:')`, schema v4 auto-runs
- `fs.mkdtempSync` for filesystem tests
- Do NOT modify existing source or test files
- Import from `@mcptoolshop/proof-lab-core` and `@mcptoolshop/game-foundry-registry`
- Seed variants with various `production_state` and `pack_present` values to test proof logic
