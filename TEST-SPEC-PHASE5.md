# Game Foundry OS — Phase 5 Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 588 tests passing across 78 files
**Goal:** Fill Phase 5 gaps. Target: ~650 tests.

## What's Covered (43 tests in studio-bootstrap-core/tests/core.test.ts)

Templates, bootstrap lifecycle, registry/vault seeding, runtime/theme/proof shell installation, diagnostics, project status, next-step.

## Tests to Write

### 1. `packages/studio-bootstrap-core/tests/seed-vault-edge.test.ts` (5 tests)

```
describe('seed vault edge cases')
  it('all seeded pages have valid frontmatter with required fields')
  it('combat_first mode creates encounter-patterns.md')
  it('story_first mode does not create encounter-patterns.md')
  it('vault pages have correct kind fields')
  it('repeated seeding does not duplicate pages')
```

### 2. `packages/studio-bootstrap-core/tests/runtime-shell-edge.test.ts` (5 tests)

```
describe('runtime shell edge cases')
  it('battle_scene.gd contains documented regions')
  it('combat_hud.gd contains panel region stubs')
  it('sprite_loader.gd contains FOUNDRY_PATH constant')
  it('encounter_loader.gd contains load function stub')
  it('creates assets/sprites and assets/portraits directories')
```

### 3. `packages/studio-bootstrap-core/tests/diagnostics-edge.test.ts` (5 tests)

```
describe('diagnostics edge cases')
  it('fails when godot project file missing')
  it('fails when canon vault directory missing')
  it('fails when battle_scene.gd missing')
  it('passes when all components present')
  it('reports multiple failures in one diagnostic run')
```

### 4. `packages/studio-bootstrap-core/tests/import-project.test.ts` (4 tests)

```
describe('import existing project')
  it('detects Godot project by project.godot file')
  it('reports missing canon vault')
  it('reports missing proof shell')
  it('identifies existing sprite pack directories')
```

### 5. `packages/studio-mcp/tests/studio-workflow.test.ts` (10 tests)

**End-to-end bootstrap workflow.**

```
describe('full studio bootstrap workflow')
  it('creates project record')
  it('bootstraps template with all shells')
  it('seeds registry with proof suites and freeze policies')
  it('seeds vault with canon pages')
  it('installs runtime shell with Godot files')
  it('installs theme shell')
  it('installs proof shell')
  it('diagnostics pass on fully bootstrapped project')
  it('project_status shows all components installed')
  it('get_next_step suggests production start after bootstrap')
```

### 6. `packages/studio-mcp/tests/studio-stubs.test.ts` (4 tests)

```
describe('stub creation')
  it('create_chapter_stub creates canon page + registry record')
  it('create_character_stub creates canon page + character record')
  it('stubs have valid frontmatter')
  it('stubs are linked to project scope')
```

### 7. `packages/studio-mcp/tests/template-diff.test.ts` (3 tests)

```
describe('template diff')
  it('reports missing files when project diverges from template')
  it('reports clean when project matches template')
  it('identifies extra files not in template')
```

### 8. `packages/registry/tests/schema-v6.test.ts` (5 tests)

```
describe('schema migration v6')
  it('project_templates table exists with template_key unique')
  it('project_bootstraps table exists with bootstrap_mode')
  it('bootstrap_artifacts table exists')
  it('template_policies table exists')
  it('schema version is 6')
```

### 9. `packages/studio-bootstrap-core/tests/template-policies.test.ts` (4 tests)

```
describe('template policies')
  it('default template has blocking placeholder policy')
  it('default template has blocking runtime integrity policy')
  it('default template has warning-only portrait policy')
  it('policies stored correctly in template_policies table')
```

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `studio-bootstrap-core/tests/seed-vault-edge.test.ts` | 5 | High |
| `studio-bootstrap-core/tests/runtime-shell-edge.test.ts` | 5 | **Critical** |
| `studio-bootstrap-core/tests/diagnostics-edge.test.ts` | 5 | High |
| `studio-bootstrap-core/tests/import-project.test.ts` | 4 | High |
| `studio-mcp/tests/studio-workflow.test.ts` | 10 | **Critical** |
| `studio-mcp/tests/studio-stubs.test.ts` | 4 | Medium |
| `studio-mcp/tests/template-diff.test.ts` | 3 | Medium |
| `registry/tests/schema-v6.test.ts` | 5 | Medium |
| `studio-bootstrap-core/tests/template-policies.test.ts` | 4 | Medium |
| **Total** | **45** | |

**Target after completion:** 633 tests (588 existing + 45 new)

## Rules

- `vitest`, `openDatabase(':memory:')`, schema v6 auto-runs
- `fs.mkdtempSync` for all filesystem/vault/Godot project tests
- Do NOT modify existing source or test files
- Import from `@mcptoolshop/studio-bootstrap-core` and `@mcptoolshop/game-foundry-registry`
