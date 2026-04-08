Phase 5 — Project Template + Studio Bootstrap Spec
Purpose

Turn Game Foundry OS from a powerful internal system into a repeatable starting point for new games.

Phase 0 made projects inspectable. Phase 1 made sprite production a real workflow. Phase 2 made encounter production a real workflow. Phase 3 made proof and freeze mechanical. Phase 4 made canon and design intent queryable.

Phase 5 closes the final startup gap:

A new game can be created with a professional baseline already wired: canon, registry, MCP tools, engine contracts, proving hooks, and a usable combat/game shell.

This phase is where you stop beginning every project from a blank repo and start from a real studio-grade operating foundation.

Phase 5 outcome

At the end of Phase 5, you should be able to ask:

Can I spin up a new tactics-RPG project with Game Foundry already wired?
Does the new project come with a valid Obsidian vault, registry, MCP config, and Godot structure?
Does the project already know how sprite packs, encounter manifests, portraits, and proof receipts should flow?
Can I bootstrap Chapter 1 production without re-inventing runtime contracts?
Can I generate a project that starts with a real combat shell instead of a debug battlefield?
Can the system tell me what the new project is missing on day one?

And get authoritative answers from MCP.

You should also be able to:

create a new game from a template
seed its registry and canon vault automatically
install a professional Godot baseline
initialize the MCP toolchain against the new project
run first proof/bootstrap checks immediately
Scope
In scope
project creation workflow
reusable Godot tactics/combat template
bootstrap of registry + canon vault + MCP config
seeded project doctrine files
starter proving harness scaffold
starter battle/combat UI shell
starter asset/encounter contracts
starter design token/theme system
starter chapter/canon structures
project status/bootstrap diagnostics
Out of scope for Phase 5
one-click published commercial game
full art style generation
genre-agnostic support for every kind of game
multi-engine parity beyond what is intentionally templated
advanced editor plugins unless directly required for bootstrap

Phase 5 is about starting professionally, not shipping automatically.

Core doctrine
Template is not a skeleton repo

A proper template is not a folder with some files. It is a working contract surface.

A new project should begin with:

known directory structure
known runtime contracts
known canon shape
known proof shape
known MCP integration
known UI shell quality floor
The template must embody doctrine

Every painful lesson from prior projects should be baked in:

no hidden placeholder debt
no untracked sprite variants
no encounter data blobs with silent drift
no battle scene that starts as a raw debug surface
no rediscovery of basic UI hierarchy
Start from the target game type, not generic scaffolding

Do not over-generalize the first template. The first real template should be:

Godot combat-forward 2D tactics / party RPG template

That is the right level of specificity because it matches the production wounds that drove Game Foundry OS.

Template product
Template name

Suggested first template:

godot-tactics-template

This is the first strong template because:

it has the clearest doctrine
it benefits most from sprite/encounter/proof/canon integration
it exposes the exact seams that previously broke
Template layers
1. Project shell

Creates the top-level repo structure and configuration.

Includes:

project metadata
package/workspace config
MCP server config
registry DB init hooks
canon vault root
Godot project root
docs/proof/handoffs scaffolding
2. Canon shell

Seeds a structured Obsidian vault.

Includes:

vision page
project doctrine page
freeze matrix page
chapter stubs
character stub directory
combat doctrine page
UI doctrine page
art doctrine page
handoff scaffold
3. Registry shell

Initializes the DB and baseline records.

Includes:

project record
initial chapter records if requested
starter proof policies
starter freeze policies
starter page registrations if canon sync is run
4. Runtime shell

Seeds the Godot project with a usable baseline.

Includes:

battle scene shell
combat HUD shell
initiative lane shell
active unit panel shell
action bar shell
target preview shell
boss frame shell
asset loader contracts
encounter loader contracts
proving harness scaffold
5. Theme shell

Seeds a real visual system.

Includes:

design tokens
font hierarchy
panel styles
color tokens
hover/select/confirm states
spacing and sizing doctrine
battle UI baseline styles
6. Proof shell

Seeds the proving surface.

Includes:

starter proof suites
runtime integrity checks
asset/encounter integrity harness hooks
freeze policy defaults
report output structure
Bootstrap modes
Mode 1 — Blank doctrine baseline

Creates an empty but fully wired project.

Use when:

starting a brand-new game
no chapter content yet
want structure first
Mode 2 — Story-first bootstrap

Creates a project with canon emphasis.

Use when:

project starts from world/story/chapter planning
production content not yet authored

Seeds more chapter and character pages up front.

Mode 3 — Combat-first bootstrap

Creates a project with a stronger runtime shell.

Use when:

project starts from battle design or gameplay loop
you need a real combat scene and test encounter immediately

This should be the default for your work.

Mode 4 — Import existing project

Wraps an existing repo in Game Foundry OS.

Use when:

retrofitting a current game
importing an older Godot project
migrating content into the new operating model

This is critical because not every project will start greenfield.

Registry schema additions

Phase 5 needs relatively few new tables if prior phases are strong, but it does need project/bootstrap records.

1. project_templates

Defines available templates.

Fields:

id
template_key
display_name
engine
genre_profile
version
description
created_at

Examples:

godot-tactics-template
later: godot-dialogue-rpg-template
2. project_bootstraps

Tracks bootstrap runs.

Fields:

id
project_id
template_id
bootstrap_mode
target_path
result (pass, fail, partial)
details_json
receipt_hash
created_at
3. bootstrap_artifacts

Tracks generated files/artifacts.

Fields:

id
project_bootstrap_id
artifact_type (vault_page, godot_scene, theme_file, proof_policy, config, starter_manifest, etc.)
path
content_hash
created_at
4. template_policies

Stores template defaults for proof/freeze/bootstrap expectations.

Fields:

id
template_id
policy_key
policy_json
created_at
5. state_events

Reuse immutable event log with:

entity_type = project_bootstrap
entity_type = template
entity_type = project
Runtime template doctrine

This is the highest-value part of Phase 5.

The battle shell must not be a debug surface

The starter battle scene must already include:

active unit banner
initiative lane
action panel
selected unit card
target preview panel
boss frame region
board overlay states
battle backdrop/frame
basic action feedback hooks

Not final polish. But absolutely not a blank simulation grid.

Combat shell minimum quality floor

A first-time project should already answer:

whose turn is it
what unit is selected
what actions are available
where can I move
who can I target
what happened after an action

That baseline must be in the template.

Asset contract shell

The template should already know:

where sprite packs go
where portraits go
how encounter manifests are loaded
how runtime variants resolve
how proof checks inspect these surfaces
Proof hooks in runtime

The Godot shell should be born with:

runtime integrity hook points
encounter loader entry point
proof harness scene/script structure
placeholder reporting surface

The template should not wait until later to become observable.

Canon template doctrine

The vault should not start blank.

Seed:

vision.md
production-roadmap.md
visual-thesis.md
combat-doctrine.md
ui-doctrine.md
art-doctrine.md
freeze-matrix.md
chapter-01.md stub
character-index.md
encounter-index.md
handoff-index.md

Each seeded page should:

have valid frontmatter
already link to project scope
be sync-ready for Phase 4 tools
Bootstrap doctrine
A bootstrap is successful when

A new project can immediately:

sync canon vault
answer project status
create/query sprite variants
create/query encounters
verify runtime shell paths
run proof readiness checks
show a non-embarrassing starter combat scene
Bootstrap should emit receipts

Every bootstrap run should record:

which template version was used
which mode was selected
which files were created
whether any generation failed
what next step the project should take

This is not optional. Bootstrap without receipts recreates the same visibility problems.

Phase 5 MCP tool set

Ship these first 12 tools.

1. studio.create_project
Purpose

Create a new project from a selected template.

Input
project_id
project_name
template_key
bootstrap_mode
target_path
optional chapter count / starter config
Output
project record
bootstrap run record
next step = studio.bootstrap_template
2. studio.bootstrap_template
Purpose

Generate the template files/artifacts into the target path.

Input
project_id
optional overrides
Output
created file summary
bootstrap receipt
next step suggestions
3. studio.seed_registry
Purpose

Initialize project-level registry records and defaults.

Input
project_id
template defaults / overrides
Output
project records seeded
default policies seeded
proof/freeze defaults seeded
4. studio.seed_vault
Purpose

Generate the structured Obsidian canon shell.

Input
project_id
vault path
mode-specific options
Output
seeded pages
invalid/missing pages if any
next step = canon.sync_vault
5. studio.install_runtime_shell
Purpose

Install the Godot runtime shell and starter combat surface.

Input
project_id
Godot root path
mode-specific options
Output
installed scenes/scripts/theme files
runtime shell receipt
verification summary
6. studio.install_theme_shell
Purpose

Install visual/design-token baseline.

Input
project_id
theme options optional
Output
theme artifacts
style token summary
next step suggestions
7. studio.install_proof_shell
Purpose

Install proof/freeze starter policy and harness surfaces.

Input
project_id
policy profile optional
Output
proof policy files/records
starter freeze policy summary
8. studio.project_status
Purpose

Return one high-level project bootstrap/infrastructure view.

Output
template used
bootstrap result
canon seeded?
registry seeded?
runtime shell installed?
proof shell installed?
next step

This is the central operator tool.

9. studio.bootstrap_diagnostics
Purpose

Check whether a newly created project is actually usable.

Checks
required directories exist
canon pages valid enough to sync
runtime shell files present
proof shell present
MCP config valid
registry reachable
Output
pass/fail
blockers
warnings
recommended next action
10. studio.get_template_info
Purpose

Return what a template includes and what doctrines it assumes.

Output
template contents
engine/genre profile
included shells
bootstrap modes supported
policy defaults
11. studio.import_existing_project
Purpose

Wrap an existing repo in the template/runtime/canon/proof shell where possible.

Input
existing project path
target project id
import mode
Output
import report
detected structures
missing pieces
next step suggestions

This is a critical non-greenfield tool.

12. studio.get_next_step
Purpose

Return exact bootstrap or template-completion blockers.

Output
current bootstrap state
missing shells
validation debt
recommended next action
Follow-up tools for Phase 5B
13. studio.create_chapter_stub

Generate canon + production scaffold for a new chapter.

14. studio.create_character_stub

Generate canon + foundry scaffold for a new character/variant.

15. studio.export_template

Package a template version as a reusable release artifact.

16. studio.diff_project_vs_template

Detect drift between a project and its template baseline.

Bootstrap flow
Recommended default flow
studio.create_project
studio.bootstrap_template
studio.seed_registry
studio.seed_vault
studio.install_runtime_shell
studio.install_theme_shell
studio.install_proof_shell
canon.sync_vault
studio.bootstrap_diagnostics
studio.project_status

At the end of that flow, the project should be structurally real.

Starter Godot template contents
Core scenes/scripts

Suggested initial shell:

battle_scene.tscn
battle_scene.gd
combat_hud.tscn
combat_hud.gd
initiative_lane.tscn
active_unit_panel.tscn
action_bar.tscn
target_preview.tscn
boss_frame.tscn
sprite_loader.gd
encounter_loader.gd
proof_runtime_hooks.gd
theme/ resources
Starter data/contracts
sprite pack contract example
portrait pack contract example
encounter manifest schema/example
project config example
placeholder reporting hook
Quality doctrine

The first launch should look like a game shell, not a systems mockup.

Template policy doctrine

Template defaults should declare:

placeholders are blocking by default
runtime path integrity is blocking
encounter bounds/formation integrity is blocking
portraits may be warning-only by default unless boss/party scoped
chapter proof shell expected even before full content exists
battle shell readability is required baseline, not optional polish

These defaults matter because they shape project behavior from day one.

Suggested repo/package shape
Keep modules separate internally
packages/game-foundry-registry
packages/studio-bootstrap-core
packages/godot-tactics-template
packages/game-foundry-mcp
Recommended new split
studio-bootstrap-core

Owns:

project bootstrap logic
template install logic
receipt generation
diagnostics
project status computation
godot-tactics-template

Owns:

actual template files
runtime shell assets
theme shell assets
starter policies and docs
game-foundry-mcp

Owns:

tool registration
request validation
namespaced MCP interface

This keeps bootstrap logic separate from template assets.

Phase 5 test plan
Project creation tests
new project record created correctly
bootstrap mode captured correctly
invalid template key fails cleanly
Bootstrap tests
files generated in expected locations
receipts written
repeated bootstrap behaves safely
partial failure reported honestly
Registry/vault seed tests
registry defaults seeded
proof/freeze policies seeded
canon pages generated with valid frontmatter
canon sync succeeds on fresh project
Runtime shell tests
required Godot scenes/scripts installed
runtime shell launches without missing-contract errors
battle shell contains required regions
sprite/encounter loader contracts present
Diagnostics tests
missing shell components fail diagnostics
valid bootstrap passes
next-step output points to the correct missing layer
Import tests
existing project scan works
missing structures reported accurately
non-destructive import path works safely
Real-world bootstrap tests

Use two proving slices:

Fresh tactics project from template
Import/wrap an existing Godot project with partial structure

These prove both greenfield and retrofit viability.

Acceptance gates

Phase 5 is complete when all of these are true:

Gate A — professional bootstrap truth

A new project can be created with registry, canon, runtime shell, proof shell, and diagnostics all wired.

Gate B — usable runtime baseline

The starter Godot battle shell is readable and structurally honest enough that it does not begin as a debug embarrassment.

Gate C — canon/bootstrap truth

The seeded vault is valid, syncable, and linked to the new project.

Gate D — diagnostics truth

studio.bootstrap_diagnostics can tell whether the project is actually ready to begin production.

Gate E — retrofit truth

At least one existing project can be imported/wrapped with a useful report rather than requiring greenfield only.

Gate F — first-production readiness

A newly bootstrapped project can immediately create a character variant, create an encounter, sync canon, and run basic project status/proof checks without additional scaffolding work.

Strongest implementation order
Phase 5A

Ship first:

schema additions
studio.create_project
studio.get_template_info
studio.bootstrap_template
studio.seed_registry
studio.project_status

This gets template/bootstrap substrate real.

Phase 5B

Then: 7. studio.seed_vault 8. studio.install_runtime_shell 9. studio.install_theme_shell 10. studio.install_proof_shell 11. studio.bootstrap_diagnostics 12. studio.get_next_step

This gets project startup actually useful.

Phase 5C

Then: 13. studio.import_existing_project 14. studio.create_chapter_stub 15. studio.create_character_stub 16. one greenfield + one retrofit proving slice

This closes the real-world adoption loop.

Recommended first proving slice

Use two proving slices.

Slice 1 — Greenfield

Create a fresh tactics-RPG project from godot-tactics-template.

Prove:

project boots cleanly
canon sync works
runtime shell exists
diagnostics pass
first character + first encounter can be created through MCP
Slice 2 — Retrofit

Import a partial existing Godot tactics project.

Prove:

import report is honest
missing shell/components identified
runtime/canon/proof gaps surfaced clearly

Why both:

greenfield proves the aspirational workflow
retrofit proves the template is actually useful in the real world you already live in
Summary

Phase 5 is where Game Foundry OS becomes a repeatable starting point for real projects:

templates are real
bootstrap is receipted
canon, runtime, and proof shells are seeded
diagnostics are honest
new projects start professionally
old projects can be wrapped instead of discarded

That is the phase where the system stops being only an internal control plane and becomes a studio-grade game starting system.