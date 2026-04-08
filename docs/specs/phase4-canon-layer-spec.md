Phase 4 — Canon Layer + Obsidian Integration Spec
Purpose

Turn design intent into a first-class system surface.

Phase 0 made the project inspectable. Phase 1 made sprite production a real workflow. Phase 2 made encounter production a real workflow. Phase 3 made proof and freeze mechanical.

Phase 4 closes the human-intent gap:

Chapter intent, character law, encounter purpose, storyboard beats, and freeze doctrine become queryable canon linked to production and runtime truth.

This phase is where Game Foundry OS stops relying on chats, memory, and scattered markdown and gains a real design-memory layer.

Phase 4 outcome

At the end of Phase 4, you should be able to ask:

What is Bell Warden supposed to be, in one canonical place?
What is the visual law for Chapter 1 enemies?
Which encounter is undead_doctrine supposed to communicate tactically?
Which character bibles exist but are not yet linked to production variants?
Which chapter is frozen mechanically but missing canon freeze notes?
What changed in Avar’s boss doctrine between two iterations?
Can the system generate a handoff packet from canon + production + proof truth together?

And get authoritative answers from MCP.

You should also be able to:

create canonical chapter/character/encounter records
link Obsidian notes to runtime objects with stable IDs
diff canon intent against production/runtime truth
generate handoff artifacts without repo archaeology
Scope
In scope
structured Obsidian vault conventions
canonical IDs for design objects
canon object registry
chapter / character / faction / encounter / combat doctrine / UI doctrine pages
links between canon objects and production/runtime/proof objects
canon queries
canon drift detection
handoff and freeze packet generation from canon + registry truth
timeline/history for canon changes
Out of scope for Phase 4
full visual storyboard editor
rich media asset editing inside Obsidian
collaborative multi-user authoring workflows
final publishing website/docs portal
generalized non-game knowledge management

Phase 4 is about design-memory truth, not a universal notes platform.

Core doctrine
Canon is not docs-as-clutter

Canon exists to answer:

what is this thing supposed to be?
how should it feel/function/look?
what rules constrain it?
how does it connect to runtime truth?

Canon is not a dump of thoughts. It is structured intent.

Obsidian is the design cockpit, not the database

Obsidian holds human-readable pages. The registry holds queryable state. Phase 4 links the two.

Stable IDs first

Every important design object must have a stable canonical ID.

Examples:

tfr-ch1
tfr-char-avar
tfr-enc-avar-boss
tfr-faction-undead
tfr-ui-battle-scene
tfr-proof-ch1-freeze

Without stable IDs, canon cannot reliably attach to production truth.

Canon object model
1. Project

Holds:

vision
production roadmap
visual thesis
core doctrine
freeze matrix
design pillars
2. Chapter

Holds:

chapter purpose
route structure
chapter visual law
chapter combat role
key encounters
required asset families
freeze notes
3. Character

Holds:

role
faction
silhouette law
portrait law
narrative role
combat role
must-survive cues
state/variant notes
4. Faction

Holds:

visual family law
tactical family law
value/silhouette rules
relation to other factions
5. Encounter

Holds:

tactical purpose
route placement
composition intent
boss/add role if applicable
special rules in human terms
expected player pressure
6. Combat doctrine

Holds:

system-level combat rules
role taxonomy
action philosophy
UI readability doctrine
boss framing doctrine
7. Art doctrine

Holds:

sprite pipeline law
portrait doctrine
environment texture law
palette rules
reduction rules
8. Proof / Freeze note

Holds:

what was proven
what debt remains
what was waived
why something is considered frozen
Vault structure

Recommended Obsidian vault shape:

/GameFoundryVault
  /Projects
    /The Fractured Road
      /00_Project
        vision.md
        production-roadmap.md
        visual-thesis.md
        freeze-matrix.md
      /01_Chapters
        ch1.md
        ch2.md
        ...
      /02_Characters
        avar.md
        bell-warden.md
        riot-husk.md
        ...
      /03_Factions
        goblins.md
        undead.md
        militia.md
      /04_Combat
        combat-doctrine.md
        ui-doctrine.md
        encounter-patterns.md
      /05_Art
        sprite-bibles/
        portrait-bibles/
        palette-law.md
      /06_Storyboards
        storyboard-index.md
        chapter-beatboards/
      /07_Proof
        freeze-notes/
        proving-packets/
      /08_Handoffs
        chapter-handoffs/
        sprint-handoffs/
Frontmatter doctrine

Every canon page needs machine-readable frontmatter.

Required fields
id
kind
project
title
status
updated
Optional link fields
chapter_id
character_id
encounter_id
variant_ids
proof_scope
freeze_scope
runtime_scope
Example — character page
id: tfr-char-avar
kind: character
project: the-fractured-road
title: Marshal Avar
status: active
character_id: avar
variant_ids:
  - avar_armed
  - avar_desperate
chapter_id: ch1
updated: 2026-04-07
Example — encounter page
id: tfr-enc-avar-boss
kind: encounter
project: the-fractured-road
title: Marshal Avar Boss
status: active
encounter_id: avar_boss
chapter_id: ch1
variant_ids:
  - avar_armed
  - avar_desperate
updated: 2026-04-07
Registry schema additions
1. canon_pages

Canonical record for each Obsidian page.

Fields:

id
project_id
canon_id
kind (project, chapter, character, faction, encounter, combat_doctrine, art_doctrine, proof_note, handoff)
title
vault_path
status
content_hash
frontmatter_json
created_at
updated_at
2. canon_links

Links canon objects to runtime/prod/proof entities.

Fields:

id
project_id
source_canon_id
target_type (character, variant, encounter, chapter, proof_run, freeze_receipt, artifact)
target_id
link_type (describes, governs, proves, tracks, handoff_for, freeze_note_for)
created_at
3. canon_snapshots

Immutable capture of parsed content over time.

Fields:

id
project_id
canon_id
content_hash
parsed_body_json
created_at
4. canon_drift_reports

Tracks canon-vs-production/runtime differences.

Fields:

id
project_id
scope_type
scope_id
result (clean, drift, warning)
details_json
created_at
5. handoff_artifacts

Generated handoff outputs.

Fields:

id
project_id
scope_type
scope_id
artifact_type (chapter_handoff, freeze_packet, production_brief, sprint_handoff)
output_path
content_hash
details_json
created_at
6. state_events

Reuse immutable event log with:

entity_type = canon_page
entity_type = handoff_artifact
canon status changes and sync events
Canon sync doctrine
Canon import/sync

The system should be able to:

scan the Obsidian vault
parse frontmatter
register/update canon page records
detect changed content hashes
keep snapshots for history/diff
No orphan pages

A page with missing required frontmatter is not trusted as canonical. It can be visible as unregistered or invalid, but not silently accepted.

No silent drift

If canon says:

Chapter 1 needs 12 enemy variants
or Avar has 2 states
or Bell Warden has no phase2

and production/runtime truth disagrees, the system must be able to report that drift.

Phase 4 MCP tool set

Ship these first 12 tools.

1. canon.sync_vault
Purpose

Scan the Obsidian vault and register/update canon pages.

Input
project_id
vault_root
Output
pages scanned
pages registered
pages updated
invalid pages
next action suggestions
2. canon.get_page
Purpose

Return one canonical page with parsed metadata.

Input
canon_id or vault_path
Output
frontmatter
body summary
linked runtime/prod/proof objects
last sync time
3. canon.search
Purpose

Search canon content by text, kind, or scope.

Input
project_id
query
filters: kind, chapter_id, character_id, etc.
Output
matching pages
summaries
linked objects
4. canon.link_object
Purpose

Attach a canon page to a production/runtime/proof object.

Input
canon_id
target_type
target_id
link_type
Output
link record
page linkage summary
5. canon.get_character_bible
Purpose

Return the canonical design surface for one character.

Input
character_id or canon_id
Output
role summary
silhouette law
variants linked
production state summary
proof/freeze linkage if present
6. canon.get_encounter_intent
Purpose

Return the tactical design intent for one encounter.

Input
encounter_id or canon_id
Output
tactical purpose
route placement
roster intent
linked encounter manifest / production state
7. canon.diff_vs_production
Purpose

Detect drift between canon and production/runtime truth.

Input
scope_type
scope_id
Output
clean / drift / warning
exact mismatches
recommended next action

Examples:

canon says 2 boss phases, registry has 1 variant
canon says portraits required, production has portrait debt
canon says Chapter 1 has 7 encounters, encounter registry has 6 synced
8. canon.get_freeze_note
Purpose

Return canon-side freeze/proof notes for a scope.

Input
scope_type
scope_id
Output
freeze note page if present
linked freeze receipt if present
debt notes
9. canon.generate_handoff
Purpose

Create a structured handoff artifact from canon + production + proof truth.

Input
project_id
scope_type
scope_id
artifact_type
output_path optional
Output
generated handoff content/artifact
included canon pages
linked production/proof summaries

This is the handoff-grade operator tool.

10. canon.get_timeline
Purpose

Show canon change history for a scope.

Output
page sync history
snapshots
linked production/proof changes
handoff generation history
11. canon.validate_pages
Purpose

Validate frontmatter and structural canon rules.

Checks
required frontmatter present
IDs unique
kind valid
linked scope fields coherent
orphan pages reported
Output
pass/fail
invalid page list
remediation suggestions
12. canon.get_next_step
Purpose

Return exact canon/design-memory blockers and recommended action.

Output
missing pages
unlinked pages
drift issues
stale sync issues
recommended next action
Follow-up tools for Phase 4B
13. canon.create_page_stub

Generate a canonical stub page with valid frontmatter.

14. canon.compare_snapshots

Diff two canon snapshots of the same page.

15. canon.get_project_matrix

Project-wide canon coverage:

required pages
linked objects
drift status
freeze-note coverage
16. canon.export_freeze_packet

Produce a richer packet combining freeze report + canon note + handoff context.

State model

Canon pages do not need a heavy production state machine like sprites/encounters, but they do need a trust state.

Canon trust states
unregistered
registered
linked
synced
drift_warning
canonical
archived
Rules
a page becomes registered after successful sync + valid frontmatter
linked once tied to at least one real scope object
synced once latest content hash is captured
drift_warning when canon-vs-production diff fails
canonical when page is valid, linked, synced, and has no blocking drift
Drift doctrine

This is the highest-value behavior in Phase 4.

Drift examples
Character drift
canon page says Avar has 2 variants
foundry only knows 1 variant
Encounter drift
canon page says Bell Warden is quarantine-only
encounter registry says route_tag = both
Chapter drift
chapter brief says 7 encounters required
chapter matrix shows 6 engine-synced
Freeze drift
freeze report says chapter is frozen
no canon freeze note exists

The system does not need to infer every nuance from prose. It does need to detect explicit structured mismatches.

Handoff doctrine
Why this matters

A huge amount of current project friction comes from handoffs being reconstructed from chat memory.

Phase 4 should let the system build artifacts like:

chapter handoff
boss implementation handoff
visual production handoff
freeze packet
Minimum contents for a generated handoff
scope summary
linked canon intent
linked production status
linked proof/freeze status
open debt
recommended next action

This makes handoffs durable and queryable.

Suggested repo/package shape
Keep modules separate internally
packages/game-foundry-registry
packages/canon-core
packages/game-foundry-mcp
Recommended new split
canon-core

Owns:

vault sync/parsing
frontmatter validation
canon link logic
drift detection
handoff generation logic
timeline/snapshot queries
game-foundry-mcp

Owns:

tool registration
request validation
namespaced MCP interface

This mirrors Phases 1–3 and keeps canon logic testable.

Phase 4 test plan
Vault sync tests
valid pages register correctly
changed pages update content hash
deleted/moved pages handled safely
invalid frontmatter pages reported
Frontmatter validation tests
missing required fields fail
duplicate IDs fail
invalid kind fails
mismatched link fields reported
Linking tests
canon page links to variant/encounter/chapter correctly
one page can link to multiple variants where appropriate
link summaries return correctly
Drift tests
explicit structured mismatch creates drift report
clean alignment reports clean
warning-only drift class supported where appropriate
Timeline/snapshot tests
snapshots persist per page version
compare snapshots identifies frontmatter/body changes
canon timeline merges sync/link/handoff events sensibly
Handoff tests
handoff generation includes canon + production + proof data
freeze packet includes freeze note + freeze receipt links
missing linked truth is reported as debt, not hidden
Real-world bootstrap tests

Use TFR examples:

tfr-char-avar
tfr-char-bell-warden
tfr-enc-avar-boss
tfr-ch1
one freeze note page

These match the real design-memory pain points.

Acceptance gates

Phase 4 is complete when all of these are true:

Gate A — vault truth

The system can sync a structured Obsidian vault and register canonical pages with stable IDs.

Gate B — link truth

Canon pages can be linked to production/runtime/proof objects and queried together.

Gate C — drift truth

canon.diff_vs_production can detect structured canon drift for at least one real character, one encounter, and one chapter.

Gate D — handoff truth

The system can generate a handoff artifact for at least one real TFR scope.

Gate E — freeze note truth

A chapter freeze note can be linked to a real freeze receipt/report path.

Gate F — TFR proving slice

Run one real TFR chapter through canon sync, link its core pages, detect at least one meaningful drift case or clean case, and generate a valid chapter handoff artifact.

Strongest implementation order
Phase 4A

Ship first:

schema additions
canon.sync_vault
canon.validate_pages
canon.get_page
canon.search
canon.link_object

This gets the canon substrate real.

Phase 4B

Then: 7. canon.get_character_bible 8. canon.get_encounter_intent 9. canon.diff_vs_production 10. canon.get_next_step 11. canon.get_timeline

This gets canon usefulness real.

Phase 4C

Then: 12. canon.generate_handoff 13. canon.get_freeze_note 14. canon.compare_snapshots 15. one full TFR chapter handoff slice

This closes the design-memory → handoff loop.

Recommended first proving slice

Use one real chapter path as the first end-to-end canon proof.

Recommended sequence:

Avar character page — character canon + variant links
Avar boss encounter page — encounter canon + runtime/proof links
Chapter 1 page — chapter canon + encounter matrix + freeze note/handoff

Why:

this proves the layer at character, encounter, and chapter scope
it mirrors the real way projects are reasoned about
it solves the exact rediscovery/handoff pain you described
Summary

Phase 4 is where Game Foundry OS gains memory and intent:

canon is structured
Obsidian is linked
IDs are stable
design pages can talk to runtime/proof truth
drift is detectable
handoffs are generated instead of reconstructed

That is the phase where the system stops knowing only what exists and starts knowing what it is supposed to be.