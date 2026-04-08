# Game Foundry OS — v1.2.0 Orchestration Spine Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 748 tests passing across 100 files
**Goal:** Fill orchestration gaps. Target: ~800 tests.

## What's Covered

- 27 orchestration tests in `studio-bootstrap-core/tests/orchestration.test.ts` (project status, diagnostics, next-step, import)
- 35 Godot tool tests in `engine-bridge-mcp/tests/godot-tools.test.ts`
- 52 Godot edge case tests across 11 files (from test spec agent)

## Tests to Write

### 1. `packages/studio-bootstrap-core/tests/status-defects.test.ts` (8 tests)

Test that project_status correctly reflects specific defect combinations.

```
describe('project status defect classification')
  it('status=blocked when runtime shell missing')
  it('status=drifted when display settings non-integer-scaling')
  it('status=incomplete when no bootstrap record exists')
  it('status=ready when all shells present and engine truth clean')
  it('missing_shells lists exactly the missing ones')
  it('repair_candidates only includes repairable findings')
  it('engine_truth.project_config_valid reflects project.godot existence')
  it('engine_truth.shell_compliance reflects shell file presence')
```

---

### 2. `packages/studio-bootstrap-core/tests/diagnostics-source-tracing.test.ts` (6 tests)

Test that every diagnostic finding traces back to a source tool.

```
describe('diagnostic source tracing')
  it('missing shell file finding has source_tool=template_shell_verify')
  it('missing autoload finding has source_tool=autoload_contract')
  it('import violation finding has source_tool=asset_import_audit')
  it('missing canon vault finding has source_tool=canon_vault')
  it('findings have unique IDs')
  it('repairable findings have non-null repair_action')
```

---

### 3. `packages/studio-bootstrap-core/tests/next-step-priority.test.ts` (8 tests)

Test the deterministic priority ordering.

```
describe('next-step priority ordering')
  it('repairable critical blocker takes priority over major')
  it('non-repairable critical takes priority over major')
  it('major takes priority over minor')
  it('returns exact repair action key, not description')
  it('returns source tool for the finding')
  it('returns bootstrap_template when no bootstrap exists')
  it('returns production suggestion when project fully ready')
  it('handles project with 0 findings correctly')
```

---

### 4. `packages/studio-bootstrap-core/tests/import-intake.test.ts` (6 tests)

Test the import path produces honest intake reports.

```
describe('import existing project intake')
  it('detects existing project.godot as Godot project')
  it('classifies missing battle_scene.gd as missing runtime shell')
  it('classifies present sprite_loader.gd as compatible')
  it('produces adoption plan with ordered steps')
  it('does not mark incomplete project as ready')
  it('handles non-Godot directory gracefully')
```

---

### 5. `packages/studio-bootstrap-core/tests/repair-loop.test.ts` (7 tests)

Test the full inspect → diagnose → repair → re-check → receipt loop.

```
describe('repair loop')
  it('diagnostics finds missing runtime shell')
  it('next-step returns studio_install_runtime_shell')
  it('after installing runtime shell, diagnostics clears that blocker')
  it('after all repairs, status becomes ready')
  it('bootstrap receipt records repair completion')
  it('re-running diagnostics after fix shows reduced blocker count')
  it('greenfield project reaches ready after full bootstrap flow')
```

This is the highest-value test in v1.2 — proves the loop works.

---

### 6. `packages/studio-mcp/tests/orchestration-mcp.test.ts` (6 tests)

Test the MCP tool wrappers call the right core functions.

```
describe('studio MCP orchestration tools')
  it('studio_project_status returns engine_truth section')
  it('studio_bootstrap_diagnostics returns findings array')
  it('studio_get_next_step returns action + source')
  it('studio_import_existing_project returns classified report')
  it('studio_project_status handles nonexistent project')
  it('studio_bootstrap_diagnostics handles project with no project.godot')
```

---

### 7. `packages/engine-bridge-mcp/tests/lib-exports.test.ts` (3 tests)

Test the new lib barrel export.

```
describe('engine-bridge lib exports')
  it('exports parseProjectGodot function')
  it('exports parseScene function')
  it('exports auditImportSettings function')
```

---

### 8. `packages/studio-bootstrap-core/tests/engine-truth-snapshot.test.ts` (4 tests)

Test the EngineTruth snapshot structure.

```
describe('engine truth snapshot')
  it('includes display dimensions from project.godot')
  it('includes stretch_mode and scale_mode')
  it('includes renderer from project.godot')
  it('reports 0 autoloads when project.godot has none')
```

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `studio-bootstrap-core/tests/status-defects.test.ts` | 8 | **Critical** |
| `studio-bootstrap-core/tests/diagnostics-source-tracing.test.ts` | 6 | **Critical** |
| `studio-bootstrap-core/tests/next-step-priority.test.ts` | 8 | **Critical** |
| `studio-bootstrap-core/tests/import-intake.test.ts` | 6 | High |
| `studio-bootstrap-core/tests/repair-loop.test.ts` | 7 | **Critical** |
| `studio-mcp/tests/orchestration-mcp.test.ts` | 6 | High |
| `engine-bridge-mcp/tests/lib-exports.test.ts` | 3 | Medium |
| `studio-bootstrap-core/tests/engine-truth-snapshot.test.ts` | 4 | Medium |
| **Total** | **48** | |

**Target after completion:** 796 tests (748 existing + 48 new)

## Rules

- `vitest`, `openDatabase(':memory:')`, schema v6 auto-runs
- `fs.mkdtempSync` for Godot project dirs with realistic file content
- Create project.godot, battle/scenes/*.gd, assets/ dirs as needed
- Import from `@mcptoolshop/studio-bootstrap-core` and `@mcptoolshop/game-foundry-registry`
- For engine parsers: import from `@mcptoolshop/engine-bridge-mcp/lib`
- Do NOT modify existing source or test files
