# Game Foundry OS — Godot Tools Test Spec

**Repo:** `F:/AI/mcp-tool-shop-org/game-foundry-os`
**Current:** 668 tests passing across 88 files
**Scope:** 8 new Godot truth reader tools in `packages/engine-bridge-mcp/`
**Goal:** Fill edge case gaps. Target: ~720 tests.

## What's Covered (35 tests in engine-bridge-mcp/tests/godot-tools.test.ts)

- parseGodotValue: 5 type cases (PackedStringArray, strings, booleans, numbers, Vector2i)
- parseProjectGodot: 6 cases (name, autoloads, plugins, display, missing file, rendering)
- parseScene: 6 cases (ext_resource, nodes, connections, header, sub_resource, empty)
- parseImportFile: 2 cases (source extraction, VRAM detection)
- auditImportSettings: 2 cases (Lossless pass, VRAM fail)
- templateShellVerify: 3 cases (pass, missing file, display settings)
- resourceUidAudit: 2 cases (missing refs, all present)
- autoloadContract: 2 cases (missing scripts, all resolve)
- signalContractAudit: 2 cases (valid connections, missing targets)
- exportAudit: 2 cases (missing cfg, valid preset)
- sceneGraph: 1 case
- assetImportAudit: 2 cases

## Rules

- `vitest`, `openDatabase(':memory:')`, schema v6 auto-runs
- `fs.mkdtempSync` for all tests — create realistic Godot project dirs
- Do NOT modify existing source or test files
- Import parsers from `../src/utils/godot-project.js`, `../src/utils/godot-scene.js`, `../src/utils/godot-import.js`
- Import tool functions from `../src/tools/*.js`
- Seed registry with `upsertProject(db, id, name, tmpDir)` for tool tests

## Tests to Write

### 1. `packages/engine-bridge-mcp/tests/godot-project-edge.test.ts` (8 tests)

```
describe('parseIniSections')
  it('returns empty map for empty file')
  it('handles sections with inline comments (;)')
  it('handles keys with no section header (global keys)')

describe('parseGodotValue edge cases')
  it('returns empty string for empty input')
  it('handles Vector2i with spaces around commas')
  it('handles PackedStringArray with empty entries')
  it('handles nested quoted strings with colons')
  it('handles raw unquoted path strings (res://path)')
```

---

### 2. `packages/engine-bridge-mcp/tests/godot-scene-edge.test.ts` (6 tests)

```
describe('parseScene edge cases')
  it('parses node with multiple properties')
  it('handles node with groups attribute')
  it('handles ext_resource without uid field (pre-4.x compat)')
  it('handles connection with flags and binds')
  it('handles scene with only header, no nodes')
  it('handles instance keyword in node (scene inheritance)')
```

---

### 3. `packages/engine-bridge-mcp/tests/godot-import-edge.test.ts` (5 tests)

```
describe('parseImportFile edge cases')
  it('returns defaults for empty/nonexistent .import file')
  it('extracts dest_files as array')
  it('detects mipmaps enabled as pixel-art violation')
  it('detects Detect 3D as pixel-art violation')
  it('handles .import file with no [params] section')

describe('auditImportSettings edge cases')
  it('skips non-.import files in directory')
```

---

### 4. `packages/engine-bridge-mcp/tests/inspect-project-edge.test.ts` (5 tests)

```
describe('inspectProject edge cases')
  it('returns full project config with all sections')
  it('throws for nonexistent project_id')
  it('correctly identifies main_scene absence as issue')
  it('extracts logging configuration')
  it('handles project.godot with minimal content')
```

---

### 5. `packages/engine-bridge-mcp/tests/template-verify-edge.test.ts` (5 tests)

```
describe('templateShellVerify edge cases')
  it('reports multiple missing shell files in one result')
  it('checks for proof harness file')
  it('reports non-integer scaling as display issue')
  it('reports non-canvas_items stretch mode as issue')
  it('passes only when all checks green')
```

---

### 6. `packages/engine-bridge-mcp/tests/uid-audit-edge.test.ts` (4 tests)

```
describe('resourceUidAudit edge cases')
  it('skips .godot directory during scan')
  it('handles scene with no ext_resource entries')
  it('reports multiple missing files from same scene')
  it('handles uid field with different UID formats')
```

---

### 7. `packages/engine-bridge-mcp/tests/autoload-edge.test.ts` (3 tests)

```
describe('autoloadContract edge cases')
  it('distinguishes singleton vs non-singleton autoloads')
  it('handles project with no autoloads defined')
  it('reports correct path for each missing autoload')
```

---

### 8. `packages/engine-bridge-mcp/tests/signal-edge.test.ts` (4 tests)

```
describe('signalContractAudit edge cases')
  it('handles scene with no connections')
  it('validates method name format (no special chars)')
  it('handles connection with nested node paths')
  it('reports multiple issues from same scene')
```

---

### 9. `packages/engine-bridge-mcp/tests/export-audit-edge.test.ts` (4 tests)

```
describe('exportAudit edge cases')
  it('detects unnamed/empty preset as warning')
  it('handles export_presets.cfg with multiple presets')
  it('reports missing platform in preset')
  it('handles malformed export_presets.cfg gracefully')
```

---

### 10. `packages/engine-bridge-mcp/tests/asset-audit-edge.test.ts` (4 tests)

```
describe('assetImportAudit edge cases')
  it('scans nested subdirectories for .import files')
  it('reports multiple violations per file')
  it('handles custom asset_dir parameter')
  it('ignores non-texture imports (audio, etc)')
```

---

### 11. `packages/engine-bridge-mcp/tests/godot-integration.test.ts` (4 tests)

**Integration tests against real TFR project.**

```
describe('Godot tools integration with The Fractured Road')
  it('inspectProject reads TFR project.godot correctly')
  it('templateShellVerify identifies TFR shell state')
  it('autoloadContract checks TFR autoloads')
  it('assetImportAudit scans TFR sprite imports')
```

Point at real `F:/AI/the-fractured-road`.

---

## Summary

| Test File | New Tests | Priority |
|-----------|-----------|----------|
| `godot-project-edge.test.ts` | 8 | **Critical** |
| `godot-scene-edge.test.ts` | 6 | **Critical** |
| `godot-import-edge.test.ts` | 5 | High |
| `inspect-project-edge.test.ts` | 5 | High |
| `template-verify-edge.test.ts` | 5 | High |
| `uid-audit-edge.test.ts` | 4 | Medium |
| `autoload-edge.test.ts` | 3 | Medium |
| `signal-edge.test.ts` | 4 | Medium |
| `export-audit-edge.test.ts` | 4 | Medium |
| `asset-audit-edge.test.ts` | 4 | Medium |
| `godot-integration.test.ts` | 4 | **Critical** |
| **Total** | **52** | |

**Target after completion:** 720 tests (668 existing + 52 new)
