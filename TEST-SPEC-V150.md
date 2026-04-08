# TEST-SPEC v1.5.0 — Battle Scene / Combat Presentation Spine

Status: **Complete** — 113 new tests shipped (1009 → 1122), spine fully wired.

## What v1.5.0 Proves

Game Foundry OS can now answer: **"Is this battle scene readable and playable?"** — not just "do the files exist?"

A bad battle scene automatically produces `battle_*` findings that degrade `presentation_integrity`, those findings are visible through the unified MCP host (122 tools), and the system points to concrete repair actions.

---

## Shipped Tests (113 new, 1122 total)

### schema-v9.test.ts (9 tests) — registry
- [x] schema version is 9
- [x] battle_scene_contracts table exists with all columns
- [x] combat_ui_layers table exists with all columns
- [x] battle_scene_snapshots table exists with all columns
- [x] playtest_sessions table exists with all columns
- [x] battle_scene_contracts CRUD works
- [x] combat_ui_layers CRUD works
- [x] playtest_sessions CRUD works
- [x] battle_scene_snapshots CRUD works

### scene-contract.test.ts (17 tests) — battle-scene-core
- [x] creates contract from encounter with correct grid dimensions
- [x] uses default tile size, viewport, and origin from battle_scene.gd shell
- [x] uses default sprite and readability settings
- [x] populates default HUD zones and overlay order
- [x] accepts overrides for all contract fields
- [x] generates scene_key from chapter and encounter id
- [x] starts in draft production state
- [x] throws for nonexistent encounter
- [x] passes for default 3x8 grid with default viewport
- [x] fails when board exceeds viewport
- [x] checks sprite-to-tile ratio
- [x] fails sprite ratio when sprite is too small for tile
- [x] validates overlay order completeness
- [x] transitions from draft to contract_defined
- [x] emits state event on transition
- [x] rejects illegal backward transitions
- [x] supports full forward chain (draft → frozen)

### ui-layers.test.ts (20 tests) — battle-scene-core
- [x] creates all 5 combat UI layers
- [x] assigns unique z_order to each layer
- [x] intent layer is always_on
- [x] threat layer is toggle
- [x] forecast layer is selection-activated
- [x] each layer has shows_json describing what it renders
- [x] intent and threat layers have required_data_fields
- [x] terrain and planning_undo have no required_data_fields
- [x] replaces existing layers when called again
- [x] throws for nonexistent contract
- [x] passes when all enemies have required fields
- [x] fails threat layer when enemies lack move_range
- [x] fails intent layer when enemies lack facing
- [x] fails forecast layer when enemies lack hp
- [x] terrain layer passes even with no data (graceful)
- [x] planning_undo layer always passes
- [x] detects z_order conflicts when layers share same z
- [x] passes with empty encounter (no enemies)
- [x] returns layers ordered by z_order
- [x] returns empty array for contract with no layers

### scene-proof.test.ts (27 tests) — battle-scene-core
- [x] board_fits_viewport passes for default 3x8 grid
- [x] board_fits_viewport fails for oversized grid
- [x] tile_size_consistent passes for 64px
- [x] tile_size_consistent warns for non-64px
- [x] sprite_to_tile_ratio passes for 48px sprites on 64px tiles
- [x] sprite_to_tile_ratio fails for oversized sprites
- [x] sprite_to_tile_ratio warns when no metrics provided
- [x] unit_occupancy_on_board passes for in-bounds units
- [x] contrast_vs_background passes for bright sprites
- [x] contrast_vs_background fails for dark sprites
- [x] hud_overlap_pressure passes for default setup
- [x] hud_no_unit_occlusion passes when units not under HUD
- [x] overlay_z_order_valid passes for default layers
- [x] intent/threat/forecast layer data complete for full roster
- [x] layer_legibility_space passes when indicators fit tiles
- [x] snapshot_completeness warns when snapshots missing
- [x] snapshot_completeness passes when all 5 snapshots present
- [x] returns pass when all assertions pass
- [x] returns partial when only warnings exist
- [x] returns fail when any assertion fails
- [x] persists proof run to DB
- [x] persists assertions to DB
- [x] produces 13 assertions
- [x] generates receipt_hash
- [x] handles empty encounter (no enemies)
- [x] handles contract with no layers configured
- [x] all sprites below contrast threshold results in fail

### scene-snapshot.test.ts (9 tests) — battle-scene-core
- [x] captures neutral state with correct layout
- [x] captures threat_on state with threat and intent layers active
- [x] computes unit positions in pixel space from grid
- [x] includes board_rect in layout
- [x] includes HUD zones in layout
- [x] captures all 5 canonical states
- [x] each snapshot has different active layers
- [x] returns all captured snapshots
- [x] returns empty for contract with no snapshots

### playtest-hook.test.ts (11 tests) — battle-scene-core
- [x] creates a session in started state
- [x] links to scene contract if one exists
- [x] records read failures and updates count
- [x] appends to existing failures
- [x] rejects recording on completed session
- [x] sets verdict and completed state
- [x] rejects double completion
- [x] returns untested for encounter with no sessions
- [x] returns good for passing playtest with no failures
- [x] returns poor for failing playtest
- [x] returns marginal for many failures even with pass verdict

### scene-diagnostics.test.ts (8 tests) — battle-scene-core
- [x] reports no_scene_contract when encounter has no contract
- [x] reports no_layers when contract exists but no layers
- [x] reports missing_snapshots when fewer than 5 captured
- [x] reports no_playtest when no completed playtest exists
- [x] reports playtest_failures when latest playtest failed
- [x] returns no findings for fully configured + passing scene
- [x] returns empty findings for project with no encounters
- [x] all findings use battle_ prefix

### quality-domain-battle.test.ts (7 tests) — battle-scene-core
- [x] presentation_integrity is in ALL_DOMAINS
- [x] ALL_DOMAINS has 7 domains now
- [x] battle_ prefix findings map to presentation_integrity
- [x] presentation_integrity is between encounter and canon in priority
- [x] findingsByDomain groups battle_ findings into presentation_integrity
- [x] getWeakestDomain returns presentation_integrity when it is blocked
- [x] presentation_integrity finding does not route to encounter_integrity

### e2e-v150.test.ts (5 tests) — battle-scene-core
- [x] encounter → contract → layers → snapshots → proof → playtest → quality
- [x] broken scene (sprites too small) → proof fails → finding → domain degraded
- [x] encounter with missing enemy data → layer dependency fails → diagnostics fire
- [x] playtest failures → marginal verdict → readability degraded
- [x] full quality domain integration: battle findings route to presentation_integrity

### Existing test updates (4 tests adapted, 0 new)
- [x] next-step-v3: config-compliant test now satisfies scene contract
- [x] next-step-v3: continue_production test now satisfies scene contract
- [x] orchestration: production-move test now satisfies scene contract
- [x] core: continue_production test now satisfies scene contract

---

## Summary

| Category | Tests |
|----------|-------|
| Schema v9 | 9 |
| Scene Contract | 17 |
| UI Layers | 20 |
| Scene Proof (13 assertions) | 27 |
| Snapshots | 9 |
| Playtest Hook | 11 |
| Diagnostics | 8 |
| Quality Domain Integration | 7 |
| E2E | 5 |
| **Total new** | **113** |
| **Adapted existing** | 4 |

## Exit Gate Coverage

| Gate | Status | Key Test |
|------|--------|----------|
| A — Scene Contract Truth | ✅ Proven | scene-contract.test.ts: CRUD, defaults from encounter, validation |
| B — Layer Dependency | ✅ Proven | ui-layers.test.ts: 5 layers, dependency validation against roster |
| C — Proof Completeness | ✅ Proven | scene-proof.test.ts: 13 assertions, pass/fail/partial |
| D — Snapshot States | ✅ Proven | scene-snapshot.test.ts: 5 canonical states with pixel-space layout |
| E — Playtest Loop | ✅ Proven | playtest-hook.test.ts: structured read failures, readability scoring |
| F — Quality Domain | ✅ Proven | quality-domain-battle.test.ts: battle_ → presentation_integrity |
| G — Auto Findings | ✅ Proven | diagnostics wired: battle_* findings flow through studio path |
| H — MCP Operable | ✅ Proven | 14 tools registered in unified host, 122 total |
| I — Repair Catalog | ✅ Proven | 4 battle repair actions in catalog (14 total) |

## Spine Closure Verification

The spine is closed when:
1. ✅ A bad battle scene automatically produces findings
2. ✅ Those findings are visible through the unified MCP host
3. ✅ The system points to concrete repair actions
4. ✅ `presentation_integrity` domain weakens automatically
5. ✅ `get_next_step` sees battle-scene problems without manual glue
