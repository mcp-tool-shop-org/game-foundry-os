import type Database from 'better-sqlite3';
import type { ProjectStatusResult, ProjectHealthStatus, EngineTruth } from '@mcptoolshop/game-foundry-registry';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseProjectGodot } from '@mcptoolshop/engine-bridge-mcp/lib';
import type { GodotProjectConfig } from '@mcptoolshop/engine-bridge-mcp/lib';
import fs from 'node:fs';
import path from 'node:path';
import { getLatestBootstrap } from './bootstrap.js';

/** Shell files that installRuntimeShell creates */
const REQUIRED_SHELL_FILES = [
  'battle/scenes/battle_scene.gd',
  'battle/scenes/combat_hud.gd',
  'battle/scenes/sprite_loader.gd',
  'battle/scenes/encounter_loader.gd',
];

/** Required autoload names for tactics template */
const REQUIRED_AUTOLOADS = ['GameState', 'SpriteLoader', 'EncounterLoader'];

/** Check which shell files exist on disk */
function checkShellFiles(rootPath: string): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  for (const file of REQUIRED_SHELL_FILES) {
    if (fs.existsSync(path.join(rootPath, file))) {
      present.push(file);
    } else {
      missing.push(file);
    }
  }
  return { present, missing };
}

/** Build engine truth from parsed Godot config */
function buildEngineTruth(config: GodotProjectConfig, shellCompliance: boolean): EngineTruth {
  const autoloadNames = config.autoloads.map(a => a.name);
  const missingAutoloads = REQUIRED_AUTOLOADS.filter(r => !autoloadNames.includes(r));

  return {
    project_config_valid: config.config.name !== '',
    shell_compliance: shellCompliance,
    autoload_count: config.autoloads.length,
    missing_autoloads: missingAutoloads,
    display_width: config.display.width,
    display_height: config.display.height,
    stretch_mode: config.display.stretch_mode,
    scale_mode: config.display.scale_mode,
    renderer: config.rendering.renderer,
  };
}

/** Derive project health status from engine truth and registry state */
function deriveStatus(
  engineTruth: EngineTruth,
  shellMissing: string[],
  canonSeeded: boolean,
  registrySeeded: boolean,
  proofInstalled: boolean,
  bootstrapResult: string | null,
): ProjectHealthStatus {
  // No bootstrap at all
  if (!bootstrapResult) return 'incomplete';

  // Critical: project.godot missing or invalid
  if (!engineTruth.project_config_valid) return 'blocked';

  // Critical: shell files missing
  if (shellMissing.length > 0) return 'blocked';

  // Drift: display settings explicitly set but not pixel-friendly
  const isPixelFriendly = engineTruth.scale_mode === 'integer' || engineTruth.stretch_mode === 'canvas_items';
  if (engineTruth.project_config_valid && !isPixelFriendly && engineTruth.stretch_mode !== '') {
    return 'drifted';
  }

  // Drift: autoloads present in project.godot but required ones missing
  // (Only flag drift if SOME autoloads exist — empty autoloads means fresh bootstrap)
  if (engineTruth.autoload_count > 0 && engineTruth.missing_autoloads.length > 0) {
    return 'drifted';
  }

  // Incomplete: missing non-engine components
  if (!canonSeeded || !registrySeeded || !proofInstalled) return 'incomplete';

  return 'ready';
}

export function getProjectStatus(db: Database.Database, projectId: string): ProjectStatusResult {
  const project = getProject(db, projectId);
  const bootstrap = getLatestBootstrap(db, projectId);

  // Registry checks
  const canonCount = (db.prepare(
    'SELECT COUNT(*) as count FROM canon_pages WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  const suiteCount = (db.prepare(
    'SELECT COUNT(*) as count FROM proof_suites WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  const policyCount = (db.prepare(
    'SELECT COUNT(*) as count FROM freeze_policies WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  const canonSeeded = canonCount > 0;
  const registrySeeded = suiteCount > 0 && policyCount > 0;
  const proofInstalled = suiteCount > 0;

  // Template lookup
  let templateUsed: string | null = null;
  if (bootstrap?.template_id) {
    const tmpl = db.prepare(
      'SELECT template_key FROM project_templates WHERE id = ?'
    ).get(bootstrap.template_id) as { template_key: string } | undefined;
    templateUsed = tmpl?.template_key ?? null;
  }

  // Engine truth: parse project.godot if project root is known
  const rootPath = project?.root_path ?? '';
  let config: GodotProjectConfig;
  try {
    config = parseProjectGodot(rootPath);
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

  // Shell file checks
  const shellCheck = rootPath ? checkShellFiles(rootPath) : { present: [], missing: REQUIRED_SHELL_FILES };
  const runtimeShellInstalled = shellCheck.missing.length === 0;

  // Check theme shell (type_system.gd is counted in shell files above)
  const themeInstalled = rootPath ? fs.existsSync(path.join(rootPath, 'assets', 'theme')) : false;

  const shellCompliance = runtimeShellInstalled && config.config.name !== '';
  const engineTruth = buildEngineTruth(config, shellCompliance);

  const status = deriveStatus(
    engineTruth,
    shellCheck.missing,
    canonSeeded,
    registrySeeded,
    proofInstalled,
    bootstrap?.result ?? null,
  );

  // Collect blockers and warnings
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!bootstrap) {
    blockers.push('No bootstrap record found');
  } else if (bootstrap.result === 'fail') {
    blockers.push('Previous bootstrap failed');
  }

  if (!engineTruth.project_config_valid && rootPath) {
    blockers.push('project.godot missing or invalid');
  }

  for (const file of shellCheck.missing) {
    blockers.push(`Missing shell file: ${file}`);
  }

  for (const al of engineTruth.missing_autoloads) {
    warnings.push(`Missing autoload: ${al}`);
  }

  if (!canonSeeded) warnings.push('Canon vault not seeded');
  if (!registrySeeded) warnings.push('Registry not seeded (proof suites or freeze policies missing)');
  if (!proofInstalled) warnings.push('Proof shell not installed');

  // Repair candidates
  const repairCandidates: string[] = [];
  if (shellCheck.missing.length > 0) repairCandidates.push('studio_install_runtime_shell');
  if (!themeInstalled) repairCandidates.push('studio_install_theme_shell');
  if (!canonSeeded) repairCandidates.push('studio_seed_vault');
  if (!registrySeeded) repairCandidates.push('studio_seed_registry');
  if (!proofInstalled) repairCandidates.push('studio_install_proof_shell');

  // Next step
  let nextStep = 'continue_production';
  if (!bootstrap) {
    nextStep = 'bootstrap_template';
  } else if (bootstrap.result === 'pending') {
    nextStep = 'complete_bootstrap';
  } else if (bootstrap.result === 'fail') {
    nextStep = 'retry_bootstrap';
  } else if (shellCheck.missing.length > 0) {
    nextStep = 'studio_install_runtime_shell';
  } else if (!canonSeeded) {
    nextStep = 'studio_seed_vault';
  } else if (!registrySeeded) {
    nextStep = 'studio_seed_registry';
  } else if (!proofInstalled) {
    nextStep = 'studio_install_proof_shell';
  }

  return {
    project_id: projectId,
    template_used: templateUsed,
    bootstrap_result: bootstrap?.result ?? null,
    status,
    blockers,
    warnings,
    installed_shells: {
      canon: canonSeeded,
      registry: registrySeeded,
      runtime: runtimeShellInstalled,
      theme: themeInstalled,
      proof: proofInstalled,
    },
    missing_shells: shellCheck.missing,
    repair_candidates: repairCandidates,
    next_step: nextStep,
    engine_truth: engineTruth,
  };
}
