Core Godot Tools Worth Building First for Foundry
Goal and recommended build order
The goal is to make “project truth” and “done-ness” mechanically verifiable by treating the engine’s actual configuration, scene/resource graph, and automation surface as a first-class substrate—so Foundry can reason about what exists, what’s missing, and what changed, without relying on brittle editor scraping. This is especially tractable in modern Godot Engine because projects are driven by INI-style project settings, text-serialized scenes/resources, and explicit automation hooks (export, import, headless/script execution, and unit-test runners where compiled in). 

As of April 2026, the current stable branch is 4.6, with maintenance release 4.6.2 dated April 1, 2026. That matters because UID behavior evolved in the Godot 4 series (notably 4.4’s UID sidecar files), so your tooling should treat “Godot 4.x, stable branch” as the compatibility baseline, and explicitly version-stamp receipts with the engine version used to compute them. 

A build sequence that preserves the thesis (runtime truth → registry/canon/proof) while keeping each step shippable:

Truth readers (no mutations): godot.inspect_project, godot.scene_graph (plus a small “dependency surface” via ResourceLoader.get_dependencies). This creates the authoritative, queryable substrate. 
Identity and drift enforcement: godot.resource_uid_audit, godot.autoload_contract, godot.signal_contract_audit. These turn substrate into “drift detectors” and “contracts,” using engine-native UID semantics and persisted connection metadata. 
Automation truth: godot.proof_run, godot.export_audit, godot.asset_import_audit. This makes “done becomes mechanical” real by producing reproducible receipts and blockers. 
Safe mutation channel: godot.editor_apply so template installs/repairs and refactors run through editor/runtime truth, not hand-edited text surgery. 
Editor-native UX: godot.foundry_panel (the “single best editor-side enhancement”) as a main-screen plugin/dock that continuously surfaces the above truth + next steps. 
This order keeps the product “powerful” (truth + contracts + automation + controlled mutation) rather than collapsing into generic CRUD dashboards. 

Godot substrate facts that should drive architecture
Godot projects store execution-critical configuration in project.godot, a plain-text INI file. Settings can be changed from the Project Settings UI, from code, or by manually editing this file; the complete universe of settings is surfaced via the ProjectSettings API. 

Project settings also support feature-tag overrides and a root-level override.cfg mechanism, which means a status reader must distinguish between baseline settings and overridden settings if you want “bootstrap truth” to be deterministic across machines/CI. 

Scenes and resources can be text-based and version-control friendly. In Godot 4.x, .tscn/.tres formats incorporate UIDs and explicit sections (external resources, internal subresources, nodes, connections), making them reliable to parse/index and stable under renames—especially when paired with the engine’s UID mapping. 

The import pipeline is also explicit: source assets remain in the project; import configuration lives in adjacent <asset>.import files; imported binary artifacts are stored under res://.godot/imported/. The docs explicitly recommend committing .import files to VCS and not committing .godot/ (it’s cache-like and can be regenerated). 

On the automation side, Godot supports:

Running the editor or game from CLI, including running a specific scene by passing it as an argument. 
Headless mode and script execution (--script), plus --import to run imports then quit (a crucial primitive for CI and for “first open” correctness). 
CLI export in debug/release/pack modes, driven by named presets in export_presets.cfg. 
Optional built-in unit test execution via --test in builds compiled with tests enabled. 
These primitives map directly to your “proof” and “bootstrap truth” phases. 

Authoritative bootstrap and status reading with godot.inspect_project and godot.template_shell_verify
godot.inspect_project should be the canonical “bootstrap/status reader” because it answers: is this actually an instance of the template, as the engine will interpret it, not merely a folder copy. The key design choice is to compute “truth” using Godot’s own semantics wherever possible (via ProjectSettings, InputMap, ResourceUID, etc.), because the docs explicitly position project.godot values as loaded into ProjectSettings and therefore part of the engine’s authoritative configuration surface. 

What it should read, and how to do it authoritatively:

Project identity and bootstrap versioning
Read application/config/* settings (name, features, tags) and record the engine branch/features the project declares. The ProjectSettings docs emphasize using full-path keys like application/config/name, and Godot’s own project settings UI is a thin layer over these paths. 

Main scene and “proof entrypoint” posture
The presence and value of run/main_scene is the simplest machine-checkable entrypoint. Real projects include this setting in project.godot (example: run/main_scene="res://runtests.tscn"). 

If you adopt a convention like “proof scenes live under res://proof/... and are runnable scenes,” then inspect_project can assert the entrypoints exist (path resolves, UID resolves) and classify them. UIDs are specifically intended to preserve references across file renames/moves. 

Autoloads (globals), including ordering and “enabled as singleton”
Godot stores autoloads inside ProjectSettings keys prefixed with autoload/ and autoload_prepend/. The engine code shows it parsing those keys, and it treats a leading * in the stored value as “is_singleton,” stripping it from the stored path. This is exactly the contract surface you want—because it’s engine-defined, not folklore. 

This means inspect_project can emit a structured autoload list with:

name (ProjectSettings key suffix),
singleton flag (leading *),
path (after stripping *, simplified),
optional classification (script vs scene vs uid://) based on path prefix/extension. 
Input map
Use InputMap as the canonical reader because it’s explicitly defined as the singleton managing InputEventActions and is the surface users edit via Project Settings → Input Map. Your reader shouldn’t guess; it should enumerate actions and events and then compare to a template contract. 

Enabled addons/plugins
Template correctness often hinges on whether editor plugins are enabled, not just present on disk. project.godot commonly contains an [editor_plugins] enabled=PackedStringArray(...) list pointing at res://addons/.../plugin.cfg. 

Godot’s plugin documentation makes activation a deliberate Project Settings → Plugins step; the enable state is therefore part of project truth. 

Export posture
Because CLI export requires a preset name defined in export_presets.cfg, a bootstrap reader should treat “export posture exists” as a first-class signal: missing file, missing required presets, mismatched naming. 

Theme assignment and rendering/window posture
Some settings are specifically high-leverage for a 2D tactics/pixel pipeline: window/viewport base size, stretch mode, and integer scaling. For example, display/window/stretch/scale_mode="integer" is explicitly described as producing a crisp pixel art appearance by flooring the scale factor to an integer multiple. 

Theme can be treated similarly as a project-level invariant via the gui/theme/custom project setting (as documented in the class reference for theme/project settings). 

Proof/test hooks
At minimum, inspect_project should record whether the project has a runnable proof scene entrypoint and whether logging is configured (see “built-in file logging” and configurable log path settings) so proof_run has clean artifacts without special casing. 

godot.template_shell_verify is then a thin, opinionated verifier layered on top of inspect_project: it answers “is this a valid Foundry Godot tactics RPG instance; what shells are installed; what’s missing; what’s the next repair step,” but it should do so using the same engine-defined surfaces above. The output should be directly consumable by your bootstrap diagnostic and “next step” recommender because it’s computed from stable primitives (project settings + plugin enablement + autoload contracts + entrypoint existence). 

Runtime-truth graph indexing with godot.scene_graph, godot.signal_contract_audit, and godot.autoload_contract
The core promise of godot.scene_graph is: “indexer for .tscn / .tres / .res relationships” that is more reliable than editor scraping because it rides on Godot’s own file formats and UID semantics. Godot’s TSCN docs explicitly frame the format as human-readable and version-control-friendly, with a formal structure (file descriptor + external/internal resources + nodes + connections), and they explicitly call out the shift to string-based UIDs in Godot 4.x. 

A robust scene_graph should unify two complementary strategies:

Text-level structural parsing for .tscn and .tres where you want stable indexing without launching the editor
The TSCN docs define headings like ext_resource, sub_resource, node, and connection, and the file descriptor includes a uid="uid://..." in Godot 4.x. That gives you a stable grammar to build an AST and produce deterministic hashes/edges. 

For node trees, the format documents node headings containing name, parent, and sometimes type, plus keywords like instance (instancing/inheritance), owner, groups, and index. 

Engine-derived dependency and connection truth for .res binaries and for “don’t reinvent the loader” scenarios
Godot exposes a dependency surface: ResourceLoader.get_dependencies(path) returns dependency strings that may include a UID and fallback path separated by :: (UID first, fallback path third segment). This is exactly the kind of substrate you want for a cross-format graph (.tscn, .tres, .res) because it’s computed by Godot’s registered loaders rather than by guesses about binary layout. 

Separately, the import docs warn that FileAccess can “work in the editor” but break in exports for imported assets, while ResourceLoader is the correct abstraction for imported resources because it accounts for where internal files are stored. Even for tooling, anchoring “what depends on what” in ResourceLoader reduces footguns. 

What godot.scene_graph should return (and where the data comes from):

Node tree and scene ownership
Parse node headings and build absolute NodePaths, respecting the documented rules (root node has no parent, direct children use ".", parent paths omit the root node’s name). This enables deterministic ownership and enablement checks. 

Inherited scenes / instancing edges
Node tags can include an instance keyword; the engine itself treats the first node with instance (and no parent) as the base scene for scene inheritance. That’s a critical edge for canon/registry rules because inherited scenes are often where “template shell” drift hides. 

External resources, subresources, and UID-backed references
The engine loader supports ext_resource tags with path, type, id, and optionally uid. If a uid is present and resolvable, the loader prefers ResourceUID’s mapping; otherwise it falls back to the path. This dual encoding is exactly what makes UID audits and path drift detection possible. 

Signals/connections topology
The engine parses connection tags and requires from, to, signal, and method fields; it also supports optional flags, binds, unbinds, and UID-path arrays (from_uid_path, to_uid_path). So the serialized scene file is already a machine-readable event topology graph. Your signal_contract_audit should treat this as the primary truth source for wiring analysis. 

At the conceptual level, signals are explicitly positioned as a decoupling mechanism: signals allow connected Callables to react without direct references, which is why drift often hides in connections rather than in file dependencies. 

Global autoload contract as part of scene topology
Autoloads are added to the root viewport before other scenes load, and their ordering is user-controlled in Project Settings. This means your “runtime truth” graph is not just a single scene; it’s main scene + autoload prefix + connections between them. 

Godot also frames autoloads as nodes in the scene tree accessible by /root/<Name>, reinforcing that they should be treated as explicit, contract-checked runtime dependencies. 

Practically, this suggests a unified “topology receipt” that includes:

autoload list + order (from ProjectSettings),
main scene UID/path,
scene graph edges (dependencies via ResourceLoader.get_dependencies, plus structural edges via .tscn parsing),
connection graph edges (from .tscn connection tags). 
Identity and repair with godot.resource_uid_audit and safe mutation via godot.editor_apply
godot.resource_uid_audit is the mechanical backbone for “one authoritative substrate,” because Godot’s UID system exists explicitly to keep references intact across renames/moves. The ResourceUID singleton manages UID ↔ path mappings, and Godot documents that UIDs can be accessed with the uid:// scheme. 

Two Godot-native facts make UID auditing unusually powerful:

Scene/resource references can carry both UID and fallback path
The text resource loader shows that when an ext_resource has a uid field, it is resolved via ResourceUID.text_to_id() and, if known, the resolved path is used; otherwise it falls back to the serialized path. This implies your audit can detect UID/path mismatch and “stale moved path” by comparing: (a) serialized path, (b) UID-resolved path, and (c) actual file existence. 

UID coverage expanded in Godot 4.4 via sidecar .uid files for scripts and shaders
Godot announced that dedicated .uid files are generated alongside scripts and shaders (e.g., some_file.gd.uid) so scripts/shaders benefit from the UID system. The article explicitly says these .uid files should be committed to version control, and moved/deleted alongside the source file when doing filesystem operations outside Godot. This directly informs your audit rules and “repair steps.” 

From an implementation standpoint, resource_uid_audit can be structured as three passes:

Inventory
Enumerate all referenced uid:// strings from:

.tscn external resource tags (where uid="uid://..." may appear),
ResourceLoader.get_dependencies() strings that encode UID + fallback path separated by ::,
any project settings that may contain UID paths (autoload entries can point to uid://... and ProjectSettings.globalize_path() explicitly supports uid:// conversion). 
Reconcile
For each UID, ask ResourceUID for the mapped path (has_id, get_id_path) and compare it to observed fallbacks and filesystem state. ResourceUID documents that it exists to keep references intact when files are renamed/moved, so a disagreement is a high-signal drift event. 

Repair
When you do need to mutate identity, use ResourceUID’s mutation APIs (add_id, set_id, remove_id) rather than inventing your own mapping format, because these are the engine’s explicit mechanisms for UID registry management. 

Your repair tool should also surface “non-repairable without editor participation” cases: e.g., missing .uid sidecar files for scripts/shaders that were moved outside Godot, which the Godot team explicitly calls out as a workflow requirement. 

godot.editor_apply is the corresponding “safe mutation channel.” Godot explicitly supports editor-time code execution via @tool scripts and one-off editor scripts via EditorScript, and editor plugins are built on EditorPlugin. 

The key product decision you’re making is: mutations are receipts, not file edits. Concretely:

Implement mutations as approved “actions” executed inside the editor context (EditorScript, @tool plugin methods), because Godot’s plugin system is designed to extend editor functionality and manipulate project state. 
Require a structured payload and return a structured receipt (what changed, what was validated, any errors). EditorScript is explicitly a mechanism to run one-off scripts “from the Godot Editor,” with output in the editor’s console context. 
Support dry-run first, apply second, so your tooling can compute diffs and blockers before touching project state; this matches the “ProjectSettings is authoritative” posture and reduces drift from failed partial mutations. 
This is also the natural place to implement “template shell install/repair” steps: enabling plugins, registering autoloads, setting required project settings, and writing proof entrypoints—without hand-editing INI or .tscn text. Godot’s plugin docs even describe automatically registering autoloads when a plugin is enabled, reinforcing that editor-side tools are meant to configure projects, not just display status. 

Automation truth with godot.proof_run, godot.export_audit, and godot.asset_import_audit
godot.proof_run is where “done becomes mechanical” becomes real because it turns scenes/harnesses into CI-grade receipts. Godot’s command line tutorial explicitly supports running projects/scenes from the command line, running scripts, and exporting via presets. 

A proof runner can be built around four Godot-native primitives:

Deterministic launch

Run the project or a specific scene by passing the scene path on the command line. 
For harness-style runs, execute a script with --script (script must inherit SceneTree or MainLoop). This is ideal for “acceptance scene runner” scripts that load a target scene, wait for a condition, then quit. 
Machine-readable pass/fail via exit codes
SceneTree.quit(exit_code) supports an explicit exit code; Godot documents the convention that 0 is success and other codes indicate errors, and recommends keeping exit codes between 0 and 125 for portability. This is a direct foundation for “proof receipts.” 

Logs and artifacts

Godot has built-in file logging: by default it writes logs to user://logs/godot.log on desktop platforms, and you can change the log path via project settings such as debug/file_logging/log_path. 
The CLI also supports --log-file to write output/error logs to a specified path instead of the project-defined default. 
Headless caveat for screenshots
Godot’s --headless is explicitly described as enabling headless mode, and the DisplayServer docs state headless mode disables rendering and window management, returning dummy values for most display functions. This means: true headless mode is incompatible with rendered screenshot artifacts; for screenshot proofs you need a rendering-capable environment (e.g., a real display, a virtual display, or a non-headless run), or you treat screenshots as optional and only available when not running --headless. 

godot.export_audit should treat “export posture” as a contract, not a best-effort attempt. Godot’s CLI export workflow makes the dependencies explicit:

--export-release, --export-debug, and --export-pack all depend on a preset name that must match one defined in export_presets.cfg. 
--export-debug and --export-pack imply --import, meaning import correctness is a prerequisite for export correctness in automation scenarios. 
Godot also calls out that you need the editor binary (not an export template) and export templates installed for CLI export. 
So an export audit can be conceptually structured as:

validate export_presets.cfg exists and includes required preset names for your intended platform coverage,
validate “debug vs release shape” is real by running --export-pack or a lightweight export in a dry-run lane,
validate “headless/dedicated server profile” expectations explicitly by requiring a preset dedicated to that posture when relevant (instead of hoping a UI preset is equivalent). 
godot.asset_import_audit is unusually high leverage for a 2D tactics/party RPG template because Godot’s import pipeline will happily preserve bad defaults for weeks. The docs give you a crisp enforcement surface:

Importing adds a <asset>.import file next to the source file containing import configuration; these should be committed to version control. 
Imported artifacts live in the hidden res://.godot/imported/ directory; deleting these artifacts will trigger reimport, and committing .godot/ is not recommended. 
Import parameters apply to non-native resource types; Godot-native .tscn, .tres, .scn, .res do not have Import-dock options. 
For your template’s specific checks:

Textures and pixel art clarity
Godot’s image import docs describe compression modes and explicitly recommend Lossless as the common default for 2D assets and as the recommended setting for pixel art; they also warn that VRAM Compressed should be avoided for 2D due to artifacts. 

However, texture filter/repeat in Godot 4 are not purely import settings: the docs note that since Godot 4.0, filter and repeat modes are set on CanvasItem properties in 2D (with a project setting default) and per-material in 3D. So your audit must inspect both import settings and node/material defaults, or you’ll miss the real source of blur/spaghetti. 

Mipmaps and unintended “Detect 3D” drift
The docs explain that Detect 3D can automatically enable mipmaps and switch compression when a texture is used in 3D scenes, and they explicitly recommend adjusting settings if this causes quality issues (e.g., for pixel art textures). This is a clear target for an audit rule: detect textures that were reimported under Detect 3D and violate your template’s 2D settings contract. 

Pixel snap compatibility via project stretch settings
ProjectSettings documents display/window/stretch/scale_mode="integer" as producing crisp pixel art by forcing integer scale factors, and it notes the clipping risk when resizing below the base viewport size. This is a perfect example of a “template should enforce” project invariant rather than leaving it to taste. 

Audio import defaults and drift
The audio import docs specify format tradeoffs and a rich set of import options (Trim, Normalize, Loop Mode, compression modes). They also note that WAV import supports Quite OK Audio and other compressions, and the WAV importer docs say Godot imports WAV using Quite OK Audio compression by default. This provides concrete “default drift” checks: normalized/trimming accidentally enabled, loop modes set incorrectly, or compression mismatched to the asset class (SFX vs music). 

Orphaned assets and import correctness in automation
Because import artifacts are stored in res://.godot/imported/ and can be regenerated, your audit should treat missing .import files, broken .import references, or missing imported artifacts (in contexts where import hasn’t run yet) as blockers, and it should pair with --import in CI to guarantee the project has completed import before proof/export. 

Editor-native experience with godot.foundry_panel as a production plugin
If you build only one editor-facing UI tool, it should be godot.foundry_panel because Godot’s editor plugin system is explicitly designed for extending the editor, adding custom docks/screens, and integrating workflows into the engine’s day-to-day surface. 

The plugin architecture is well-defined and aligns with your intent:

Plugins live under addons/<plugin_name> with a plugin.cfg INI metadata file and a main script that must be a @tool script inheriting from EditorPlugin. 
Enabling/disabling plugins is a first-class Project Settings flow (Plugins tab) and does not require editor restart, which makes “bootstrap shell install/repair” loops feasible without manual restarts. 
This suggests foundry_panel should not be a dashboard that duplicates Foundry; it should be a production cockpit that shows engine-true status and can trigger safe, receipt-producing operations:

What it should surface (computed from tools above)

Bootstrap status (template_shell_verify + inspect_project invariants). 
Registry/canon/proof status (as Foundry receipts), plus the current scene/resource UID/path identity for “where am I?” debugging. 
Freeze blockers: missing export presets, missing autoloads, broken UID edges, dangling signal connections, import drift. 
What it should be allowed to do (through editor_apply)

Enable required editor plugins, register required autoloads, apply project settings contracts, and install/repair shells—using EditorPlugin/EditorScript execution instead of raw file edits. 
Why this makes Foundry feel “part of the engine”
Because plugin enablement, autoload registration, and project settings are all first-class engine constructs stored in the project’s authoritative configuration and manipulated in-editor, your panel becomes a live portal into engine truth rather than an external bureaucracy. 