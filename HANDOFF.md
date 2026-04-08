# Game Foundry OS — Session Handoff

## What This Is

Game Foundry OS is a game production operating system built as a unified MCP server. It manages sprite pipelines, encounter authoring, engine integration, proof/freeze orchestration, design canon, project bootstrapping, repair closure, quality domains, and staged adoption — all through 108 queryable tools backed by a single SQLite registry.

## Repo

`mcp-tool-shop-org/game-foundry-os` — npm workspaces monorepo
Local: `F:/AI/mcp-tool-shop-org/game-foundry-os`

## Current State: v1.4.0

- **108 MCP tools**, single unified server
- **971 tests** across 127 files, all passing
- **Schema v8** with 32 tables
- **14 packages** (5 core logic + 5 MCP servers + unified host + registry + bootstrap + 1 lib barrel)
- **6 quality domains**, 4 adoption profiles, 5 adoption stages
- **10 repair actions** with approval gate for moderate-risk

## MCP Config

Key `sprite-foundry` in `~/.claude.json` points to:
```
F:/AI/mcp-tool-shop-org/game-foundry-os/packages/game-foundry-mcp/index.js
```

Registry at: `~/.game-foundry/registry.db`

## Version History

| Version | Milestone |
|---------|-----------|
| v1.0.0 | All 6 phases complete (94 tools, 588 tests) |
| v1.1.0 | 8 Godot-native truth readers (102 tools, 668 tests) |
| v1.2.0 | Studio orchestration spine (102 tools, 748 tests) |
| v1.3.0 | Repair Closure Spine — plan→dry-run→apply→verify→receipt (105 tools, 866 tests) |
| v1.4.0 | Adoption + Quality Spine — domains, profiles, approval gate (108 tools, 971 tests) |

## What v1.4.0 Built

### Quality Domains (6)
Every finding maps to a game-quality domain. Next-step prioritizes by game impact.

| Domain | What It Covers | Priority |
|--------|---------------|----------|
| playability_integrity | Proof entrypoints, proof runs, slice testability | Highest |
| runtime_integrity | project.godot, shell files, autoloads, plugins | High |
| visual_integrity | Display/stretch settings, .import compliance | Medium |
| encounter_integrity | Encounter shell, runtime/proof hooks | Medium |
| canon_integrity | Canon vault, entity linking, drift | Lower |
| shipping_integrity | Export presets, build posture | Lowest |

### Adoption Profiles (4)
Projects classified at import for staged adoption:
- **greenfield**: nothing exists → full bootstrap path
- **retrofit_prototype**: project.godot exists, shells missing → safe closure first
- **vertical_slice**: shells present, some content → quality repairs + proof
- **late_stage_production**: mostly complete → proof readiness + freeze

### Adoption Stages (5)
1. Truth + Diagnostics (no mutations)
2. Safe Closure (all safe_auto repairs)
3. Quality Repairs (approval_required if moderate)
4. Proof Readiness (proof suites, slice testability)
5. Freeze Posture (freeze candidates, promotion, shipping)

### Approval Gate
- **safe** repairs: direct plan→dry_run→apply→verify (no ceremony)
- **moderate** repairs: plan→**approve**→dry_run→apply→verify
- **manual_only**: escalation packet, never auto-execute
- Approval tied to plan fingerprint — expires if truth changes

### New MCP Tools (+3)
- `studio_get_adoption_plan` — adoption profile + staged plan
- `studio_get_quality_state` — per-domain quality scores
- `studio_approve_repair` — approve pending moderate-risk plan

### Quality-Aware Next-Step (V3)
Returns `StudioNextStepV3` with:
- `quality_domain` — which game-quality domain this addresses
- `why_it_matters` — game-oriented explanation ("The game cannot launch without this runtime component")
- Domain-aware priority ordering: playability > runtime > visual > encounter > canon > shipping

## Package Map

```
packages/
  registry/                    # Schema v8, 32 tables, models, types
  sprite-foundry-core/         # Sprite lifecycle, batches, picks, artifacts, timeline
  sprite-foundry-mcp/          # 20 tools
  encounter-doctrine-core/     # Encounter lifecycle, roster, rules, validation, export, sync
  encounter-doctrine-mcp/      # 22 tools
  engine-bridge-mcp/           # 14 tools + Godot writer (registerAutoload, enablePlugin, etc.)
  proof-lab-core/              # Proof suites, freeze readiness, candidates, regressions
  proof-lab-mcp/               # 15 tools
  canon-core/                  # Vault sync, pages, links, drift, handoff, snapshots
  canon-mcp/                   # 15 tools
  studio-bootstrap-core/       # Templates, bootstrap, diagnostics, repair engine, quality domains, adoption
  studio-mcp/                  # 22 tools (16 base + 3 repair + 3 adoption/quality)
  game-foundry-mcp/            # Unified host (108 tools)
  bootstrap/                   # TFR scanner
```

## How to Work With It

```bash
cd F:/AI/mcp-tool-shop-org/game-foundry-os
npm run build
npx vitest run
```

## Repair Action Catalog

| Action Key | Risk | Approval | Scope |
|-----------|------|----------|-------|
| `studio_install_runtime_shell` | safe | auto | filesystem |
| `studio_install_theme_shell` | safe | auto | filesystem |
| `studio_install_proof_shell` | safe | auto | registry |
| `studio_seed_vault` | safe | auto | filesystem |
| `studio_seed_registry` | safe | auto | registry |
| `godot_register_autoload` | moderate | required | godot_config |
| `godot_enable_plugin` | moderate | required | godot_config |
| `godot_apply_display_setting` | moderate | required | godot_config |
| `godot_apply_rendering_setting` | moderate | required | godot_config |
| `godot_seed_export_preset` | moderate | required | filesystem |

## Test Specs

10 test spec files in the repo root. Key specs:
- `TEST-SPEC-V130.md` — Repair Closure (118 shipped, 32 gaps)
- `TEST-SPEC-V140.md` — Adoption + Quality (105 shipped, 26 gaps)

## Known Issues

- `validate_completeness` uses character_id for path lookup but multi-variant characters use variant-level names
- Godot config repairs (`godot_register_autoload`, etc.) require explicit params — auto-dispatch is escalation-only
- Autoload parser retains quotes from `*"res://..."` format
