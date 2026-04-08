import type Database from 'better-sqlite3';
import type { BootstrapDiagnosticResult, DiagnosticFinding } from '@mcptoolshop/game-foundry-registry';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseProjectGodot, auditImportSettings } from '@mcptoolshop/engine-bridge-mcp/lib';
import type { GodotProjectConfig } from '@mcptoolshop/engine-bridge-mcp/lib';
import fs from 'node:fs';
import path from 'node:path';

/** Shell files that the tactics template requires.
 *  Paths match what installRuntimeShell actually creates. */
const REQUIRED_SHELL_FILES = [
  { file: 'battle/scenes/battle_scene.gd', label: 'battle_scene' },
  { file: 'battle/scenes/combat_hud.gd', label: 'combat_hud' },
  { file: 'battle/scenes/sprite_loader.gd', label: 'sprite_loader' },
  { file: 'battle/scenes/encounter_loader.gd', label: 'encounter_loader' },
];

/** Required autoload names */
const REQUIRED_AUTOLOADS = ['GameState', 'SpriteLoader', 'EncounterLoader'];

/** Canon vault expected subdirectories */
const CANON_DIRS = ['00_Project', '01_Chapters', '04_Combat', '05_Art'];

/** Convert res:// path to absolute */
function resPathToAbsolute(projectRoot: string, resPath: string): string {
  const relative = resPath.replace(/^res:\/\//, '');
  return path.join(projectRoot, relative);
}

export function runDiagnostics(
  db: Database.Database,
  projectId: string,
  targetPath: string,
): BootstrapDiagnosticResult {
  const findings: DiagnosticFinding[] = [];

  // ── 1. Parse project.godot via engine truth ──────────────
  let config: GodotProjectConfig;
  const projectGodotPath = path.join(targetPath, 'project.godot');
  const hasProjectGodot = fs.existsSync(projectGodotPath);

  try {
    config = parseProjectGodot(targetPath);
  } catch {
    config = {
      config: { name: '', features: [], description: '' },
      run: { main_scene: '' },
      autoloads: [],
      input_actions: [],
      editor_plugins: [],
      display: { width: 0, height: 0, stretch_mode: '', scale_mode: '' },
      rendering: { renderer: '' },
      theme: { custom_theme: '' },
      logging: { file_logging_enabled: false, log_path: '' },
    };
  }

  if (!hasProjectGodot) {
    findings.push({
      id: 'engine_project_godot',
      severity: 'critical',
      source_tool: 'inspect_project',
      affected_path: 'project.godot',
      message: 'project.godot not found — Godot project not initialized',
      repairable: true,
      repair_action: 'studio_install_runtime_shell',
    });
  } else if (config.config.name === '') {
    findings.push({
      id: 'engine_project_name',
      severity: 'critical',
      source_tool: 'inspect_project',
      affected_path: 'project.godot',
      message: 'project.godot exists but has no config/name — may be corrupt or empty',
      repairable: true,
      repair_action: 'studio_install_runtime_shell',
    });
  }

  // ── 2. Shell file compliance ─────────────────────────────
  for (const shell of REQUIRED_SHELL_FILES) {
    const exists = fs.existsSync(path.join(targetPath, shell.file));
    if (!exists) {
      findings.push({
        id: `shell_${shell.label}`,
        severity: 'critical',
        source_tool: 'template_shell_verify',
        affected_path: shell.file,
        message: `Missing shell file: ${shell.file}`,
        repairable: true,
        repair_action: 'studio_install_runtime_shell',
      });
    }
  }

  // ── 3. Autoload contract ─────────────────────────────────
  if (hasProjectGodot) {
    const autoloadNames = config.autoloads.map(a => a.name);

    // Only check required autoloads if at least one autoload is configured.
    // A fresh bootstrap has no autoloads — that's normal, not a violation.
    if (config.autoloads.length > 0) {
      for (const required of REQUIRED_AUTOLOADS) {
        if (!autoloadNames.includes(required)) {
          findings.push({
            id: `autoload_missing_${required.toLowerCase()}`,
            severity: 'major',
            source_tool: 'autoload_contract',
            affected_path: 'project.godot',
            message: `Required autoload '${required}' not registered in project.godot`,
            repairable: false,
            repair_action: null,
          });
        }
      }
    }

    // Check autoload files exist on disk
    for (const al of config.autoloads) {
      const absPath = resPathToAbsolute(targetPath, al.path);
      if (!fs.existsSync(absPath)) {
        findings.push({
          id: `autoload_file_${al.name.toLowerCase()}`,
          severity: 'major',
          source_tool: 'autoload_contract',
          affected_path: al.path,
          message: `Autoload '${al.name}' references missing file: ${al.path}`,
          repairable: false,
          repair_action: null,
        });
      }
    }

    // ── 4. Display settings drift ──────────────────────────
    const isPixelFriendly = config.display.scale_mode === 'integer' || config.display.stretch_mode === 'canvas_items';
    if (!isPixelFriendly && config.display.stretch_mode !== '') {
      findings.push({
        id: 'display_not_pixel_friendly',
        severity: 'minor',
        source_tool: 'inspect_project',
        affected_path: 'project.godot',
        message: `Display settings not pixel-friendly: stretch=${config.display.stretch_mode}, scale=${config.display.scale_mode}`,
        repairable: false,
        repair_action: null,
      });
    }
  }

  // ── 5. Export presets ─────────────────────────────────────
  // Missing export_presets.cfg is minor — not needed until the project
  // is ready for distribution. Godot creates this file via the editor.
  const exportCfgPath = path.join(targetPath, 'export_presets.cfg');
  if (hasProjectGodot && !fs.existsSync(exportCfgPath)) {
    findings.push({
      id: 'export_presets_missing',
      severity: 'minor',
      source_tool: 'export_audit',
      affected_path: 'export_presets.cfg',
      message: 'export_presets.cfg not found — no export targets configured',
      repairable: false,
      repair_action: null,
    });
  }

  // ── 6. Asset import compliance ───────────────────────────
  const assetsDir = path.join(targetPath, 'assets');
  if (fs.existsSync(assetsDir)) {
    try {
      const importAudit = auditImportSettings(targetPath);
      for (const issue of importAudit.issues) {
        findings.push({
          id: `import_${issue.file.replace(/[/\\]/g, '_')}`,
          severity: issue.severity === 'error' ? 'minor' : 'minor',
          source_tool: 'asset_import_audit',
          affected_path: issue.file,
          message: issue.issue,
          repairable: false,
          repair_action: null,
        });
      }
    } catch {
      // Asset dir exists but scan failed — non-critical
    }
  }

  // ── 7. Canon vault ───────────────────────────────────────
  const vaultPath = path.join(targetPath, 'canon');
  const vaultExists = fs.existsSync(vaultPath);

  if (!vaultExists) {
    findings.push({
      id: 'canon_vault_missing',
      severity: 'critical',
      source_tool: 'canon_sync_vault',
      affected_path: 'canon/',
      message: 'Canon vault not seeded — no design documentation directory',
      repairable: true,
      repair_action: 'studio_seed_vault',
    });
  } else {
    for (const dir of CANON_DIRS) {
      if (!fs.existsSync(path.join(vaultPath, dir))) {
        findings.push({
          id: `canon_dir_${dir.toLowerCase()}`,
          severity: 'minor',
          source_tool: 'canon_sync_vault',
          affected_path: `canon/${dir}`,
          message: `Missing canon directory: ${dir}`,
          repairable: true,
          repair_action: 'studio_seed_vault',
        });
      }
    }
  }

  // ── 8. Proof shell in registry ───────────────────────────
  const suites = db.prepare(
    'SELECT COUNT(*) as count FROM proof_suites WHERE project_id = ?'
  ).get(projectId) as { count: number };

  if (suites.count === 0) {
    findings.push({
      id: 'proof_shell_missing',
      severity: 'critical',
      source_tool: 'proof_run_asset_suite',
      affected_path: 'registry:proof_suites',
      message: 'Proof shell not installed — no verification suites registered',
      repairable: true,
      repair_action: 'studio_install_proof_shell',
    });
  }

  // ── Aggregate ────────────────────────────────────────────
  const blockers = findings.filter(f => f.severity === 'critical');
  const warnings = findings.filter(f => f.severity !== 'critical');
  const repairCandidates = [...new Set(
    findings.filter(f => f.repairable && f.repair_action).map(f => f.repair_action!)
  )];

  let nextAction = 'project_ready';
  if (blockers.length > 0) {
    // Pick the first repairable blocker, else the first blocker
    const repairable = blockers.find(b => b.repairable);
    nextAction = repairable?.repair_action ?? `fix: ${blockers[0].message}`;
  }

  return {
    project_id: projectId,
    pass: blockers.length === 0,
    findings,
    blocker_count: blockers.length,
    warning_count: warnings.length,
    repair_candidates: repairCandidates,
    next_action: nextAction,
  };
}
