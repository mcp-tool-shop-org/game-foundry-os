# Game Foundry OS — Session Handoff

## What This Is

Game Foundry OS is a game production operating system built as a unified MCP server. It manages sprite pipelines, encounter authoring, engine integration, proof/freeze orchestration, design canon, project bootstrapping, repair closure, quality domains, staged adoption, and battle scene production — all backed by a single SQLite registry.

## Repo

`mcp-tool-shop-org/game-foundry-os` — npm workspaces monorepo
Local: `F:/AI/mcp-tool-shop-org/game-foundry-os`

## Current State: v1.7.0

- **1213 tests** across 154 files, all passing
- **Schema v11** with 39 tables
- **17 packages** (7 core logic + 6 MCP servers + unified host + registry + bootstrap + 1 lib barrel)
- **7 quality domains**, chapters as first-class production units
- **Chapter prove bundle** — one entrypoint runs all proofs for a chapter
- **Chapter verdict** — decisive production decision (playable/blocked/incomplete/drifted)
- **Chapter handoff artifact** — what was built, what passed, what failed, what's next
- **Freeze calibration** — is this chapter fit to freeze?
- **14 repair actions** with approval gate for moderate-risk

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
| v1.5.0 | Battle Scene / Combat Presentation Spine — scene contracts, UI layers, proof, snapshots, playtest (1122 tests) |
| v1.6.0 | Chapter Spine — chapters as first-class production units, health aggregation, encounter coverage, playtest bundle, chapter next-step (1180 tests) |
| v1.7.0 | Playable Chapter Loop — prove bundle, decisive verdict, handoff artifact, freeze calibration (1213 tests) |

## What v1.7.0 Built

### Chapter Prove Bundle
One entrypoint (`runChapterProveBundle`) runs all required proofs: chapter health computation, per-encounter scene proofs, playtest aggregation. Returns combined blocker and warning counts.

### Chapter Verdict
Decisive production state: `playable` (all proofs pass + health ready), `blocked` (any proof fails or playtest fails when required), `incomplete` (missing contracts/layers/snapshots), `drifted` (proofs pass but stale). Verdict names the exact blocking encounter, quality domain, and failing assertion.

### Chapter Handoff Artifact
Complete production report: what was built (encounter/scene/proof counts), what passed (encounter list), what failed (encounter + reason), what's blocking (encounter + domain + detail), next highest-value move. Persisted as `chapter_build_report` in `handoff_artifacts`. Strong enough that the next contributor can continue without archaeology.

### Freeze Calibration
Is this chapter fit to freeze? `playable` → can freeze (clear risk). `drifted` → can freeze (warning risk). `blocked`/`incomplete` → cannot freeze (blocked risk + blocker list).

### Hard Gates Proven
1. Foundry can produce a playable chapter artifact for Chapter 1
2. The chapter prove bundle runs from one entrypoint
3. A failed encounter proof or playtest blocks the chapter verdict automatically
4. The output identifies the exact blocking encounter and quality domain
5. The handoff artifact is strong enough for the next contributor

## What v1.6.0 Built

### Chapters as First-Class Objects
Dedicated `chapters` table with production state machine: draft → encounters_ready → scenes_ready → proof_passed → playtest_passed → frozen. Replaces string-label-only approach.

### Chapter Health Computation
Aggregates per-encounter: encounter contract status, battle scene contract, UI layers, snapshots, proof pass, playtest pass, weakest quality domain, major findings count. Chapter status derived from encounter coverage: ready, blocked, incomplete, drifted.

### Encounter Coverage Map
Per encounter in a chapter: `has_encounter_contract`, `has_battle_scene_contract`, `has_layers`, `has_snapshots`, `has_proof_pass`, `has_playtest_pass`, `weakest_domain`, `major_findings`. The map that answers "why is Chapter 1 not shippable?"

### Chapter Playtest Bundle
Not a separate kingdom — aggregates encounter-level playtests. Worst encounter verdict wins. If any encounter fails → chapter fails. Untested encounters → chapter incomplete.

### Chapter Next-Step
Finds the worst encounter in the chapter and recommends the most impactful fix: create scene contract, configure layers, run proof, start playtest. Returns the target encounter, quality domain, and game-oriented explanation.

### Hard Gates Proven
1. "Is Chapter 1 shippable?" → health.overall_status = ready when all encounters pass
2. Exact blockers by encounter → blocker_summary names the encounter
3. Playtest failures degrade chapter health automatically
4. Presentation failures show up as chapter risk
5. get_next_step recommends highest-value chapter move

## What v1.5.0 Built

### Battle Scene Contract
Central truth object binding one encounter to one scene layout. Board geometry, camera/frame, sprite expectations, HUD zones, overlay hierarchy, readability thresholds. Production state machine: draft → contract_defined → layers_configured → snapshots_captured → proof_passed → frozen.

### Combat UI Layer Contract
5 first-class layers: Intent (always_on), Threat (toggle), Forecast (selection), Terrain (toggle), Planning Undo (always_on). Each has required_data_fields validated against encounter enemy roster.

### Battle Scene Proof Suite (13 assertions)
board_fits_viewport, tile_size_consistent, sprite_to_tile_ratio, unit_occupancy_on_board, contrast_vs_background, hud_overlap_pressure, hud_no_unit_occlusion, overlay_z_order_valid, intent/threat/forecast_layer_data_complete, layer_legibility_space, snapshot_completeness.

### 5 Canonical Snapshots
neutral, threat_on, forecast, enemy_turn, pre_commit — each computes unit positions in pixel space, active layers, HUD state.

### Playtest Hook
Start session → record read failures (9 failure types) → quality verdict (pass/fail/marginal) → readability score feeds back into quality domain.

### Quality Domain: `presentation_integrity`
Inserted between encounter_integrity and canon_integrity. `battle_*` prefix findings route here. Answers "is this battle scene readable?" not just "does it validate?"

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
  battle-scene-core/           # Scene contracts, UI layers, proof, snapshots, playtest, diagnostics
  game-foundry-mcp/            # Unified host
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
- `TEST-SPEC-V140.md` — Adoption + Quality (131 shipped, 0 gaps)
- `TEST-SPEC-V150.md` — Battle Scene / Combat Presentation (113 shipped, 0 gaps)
- `TEST-SPEC-V160.md` — Chapter Spine (58 shipped, 0 gaps)
- `TEST-SPEC-V170.md` — Playable Chapter Loop (33 shipped, 0 gaps)

## Known Issues

- `validate_completeness` uses character_id for path lookup but multi-variant characters use variant-level names
- Godot config repairs (`godot_register_autoload`, etc.) require explicit params — auto-dispatch is escalation-only
- Autoload parser retains quotes from `*"res://..."` format
