# Game Foundry OS — Session Handoff

## What This Is

Game Foundry OS is a game production operating system built as a unified MCP server. It manages sprite pipelines, encounter authoring, engine integration, proof/freeze orchestration, design canon, and project bootstrapping — all through 102 queryable tools backed by a single SQLite registry.

## Repo

`mcp-tool-shop-org/game-foundry-os` — npm workspaces monorepo
Local: `F:/AI/mcp-tool-shop-org/game-foundry-os`

## Current State: v1.2.0

- **102 MCP tools**, single unified server
- **748 tests** across 100 files, all passing
- **Schema v6** with 27 tables
- **14 packages** (5 core logic + 5 MCP servers + unified host + registry + bootstrap + 1 lib barrel)
- **TFR seeded**: 18 characters, 18 variants, 7 encounters, 2 packs, 0 placeholders

## MCP Config

Key `sprite-foundry` in `~/.claude.json` points to:
```
F:/AI/mcp-tool-shop-org/game-foundry-os/packages/game-foundry-mcp/index.js
```

Registry at: `~/.game-foundry/registry.db`

## Package Map

```
packages/
  registry/                    # Schema v6, 27 tables, models, types
  sprite-foundry-core/         # Sprite lifecycle, batches, picks, artifacts, timeline
  sprite-foundry-mcp/          # 20 tools (8 inspect + 12 workflow)
  encounter-doctrine-core/     # Encounter lifecycle, roster, rules, validation, export, sync
  encounter-doctrine-mcp/      # 22 tools (7 inspect + 15 workflow)
  engine-bridge-mcp/           # 14 tools (6 bridge + 8 Godot truth readers)
  proof-lab-core/              # Proof suites, freeze readiness, candidates, regressions
  proof-lab-mcp/               # 15 tools
  canon-core/                  # Vault sync, pages, links, drift, handoff, snapshots
  canon-mcp/                   # 15 tools
  studio-bootstrap-core/       # Templates, bootstrap, seeding, engine-truth diagnostics
  studio-mcp/                  # 16 tools
  game-foundry-mcp/            # Unified host (plain JS, imports from sibling dist/ dirs)
  bootstrap/                   # TFR scanner
```

## Version History

| Version | Milestone |
|---------|-----------|
| v1.0.0 | All 6 phases complete (94 tools, 588 tests) |
| v1.1.0 | 8 Godot-native truth readers — project.godot, .tscn, .import parsing (102 tools, 668 tests) |
| v1.2.0 | Studio orchestration spine — engine-truth-backed status/diagnostics/next-step (102 tools, 748 tests) |

## What Each Phase Built

| Phase | Domain | What It Proves |
|-------|--------|----------------|
| 0 | Foundation | The system can see what exists and validate it |
| 1 | Sprite Foundry | A character can be driven concept→engine through MCP |
| 2 | Encounter Doctrine | An encounter can be driven intent→runtime through MCP |
| 3 | Proof Lab | "Done" is a system operation, not a feeling |
| 4 | Canon Layer | The system knows what things are *supposed to be* |
| 5 | Studio Bootstrap | New projects start professionally, not from blank repos |
| v1.1 | Godot Truth | Engine config/scenes/imports are machine-readable |
| v1.2 | Orchestration | inspect→diagnose→repair→re-check→receipt loop works |

## Key Tool Domains

**Sprite Foundry** (`foundry.*`): get_character_status, get_next_step, get_character_timeline, create_variant, start_concept_batch, lock_concept_pick, start_directional_batch, lock_directional_pick, assemble_sheet, slice_pack, sync_pack_to_engine, attach_portrait_set, scan_assets, validate_completeness, etc.

**Encounter Doctrine** (`doctrine.*`): doctrine_create, doctrine_add_unit, doctrine_validate_structural, doctrine_validate_dependencies, doctrine_export_manifest, doctrine_sync_to_engine, doctrine_get_chapter_matrix, doctrine_clone, etc.

**Engine Bridge** (`engine.*`): verify_runtime_paths, report_placeholders, get_battle_runtime_status, inspect_project, scene_graph, template_shell_verify, resource_uid_audit, autoload_contract, signal_contract_audit, export_audit, asset_import_audit

**Proof Lab** (`proof.*`): proof_run_asset_suite, proof_run_encounter_suite, proof_run_runtime_suite, proof_run_chapter_spine, proof_get_freeze_readiness, proof_freeze_candidate, proof_promote_freeze, proof_report_regressions, proof_generate_freeze_report

**Canon** (`canon.*`): canon_sync_vault, canon_get_character_bible, canon_get_encounter_intent, canon_diff_vs_production, canon_generate_handoff, canon_link_object, canon_validate_pages

**Studio** (`studio.*`): studio_create_project, studio_bootstrap_template, studio_project_status, studio_bootstrap_diagnostics, studio_get_next_step, studio_import_existing_project, studio_create_chapter_stub, studio_create_character_stub

## How to Work With It

```bash
# Build all packages
cd F:/AI/mcp-tool-shop-org/game-foundry-os
npm run build

# Run all tests
npx vitest run

# Re-bootstrap TFR registry
node packages/bootstrap/dist/scan-tfr.js F:/AI/the-fractured-road
```

## Test Specs for Test Claude

9 test spec files in the repo root (TEST-SPEC*.md), each with prioritized test lists ready for handoff. Total gap: ~530 tests across all specs.

## Known Issues

- `validate_completeness` uses character_id for path lookup but multi-variant characters (Avar) use variant-level names (avar_armed, avar_desperate)
- Schema version assertions in older test files need updating when new migrations are added (use `toBeGreaterThanOrEqual` instead of exact match)

## Origin Story

Started as a combat salvage sprint for The Fractured Road (Godot 4 tactics RPG). The game's combat screen was broken — sprites existed but weren't wired, encounter data had invalid grid positions, and every session rediscovered the codebase. The user said "let's build an internal system that makes it easier to build games." That pivot produced Game Foundry OS in a single session.
