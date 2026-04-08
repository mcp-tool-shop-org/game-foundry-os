import type Database from 'better-sqlite3';
import type { BootstrapDiagnosticResult } from '@mcptoolshop/game-foundry-registry';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_DIRS = [
  'battle/scenes',
  'assets/sprites',
  'assets/portraits',
  'assets/fonts',
  'assets/theme',
];

const REQUIRED_GD_FILES = [
  'project.godot',
  'battle/scenes/battle_scene.gd',
  'battle/scenes/combat_hud.gd',
  'battle/scenes/sprite_loader.gd',
  'battle/scenes/encounter_loader.gd',
];

const CANON_DIRS = [
  '00_Project',
  '01_Chapters',
  '04_Combat',
  '05_Art',
];

export function runDiagnostics(
  db: Database.Database,
  projectId: string,
  targetPath: string,
): BootstrapDiagnosticResult {
  const checks: Array<{ check: string; pass: boolean; detail: string }> = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Check required directories
  for (const dir of REQUIRED_DIRS) {
    const fullPath = path.join(targetPath, dir);
    const exists = fs.existsSync(fullPath);
    checks.push({
      check: `directory:${dir}`,
      pass: exists,
      detail: exists ? 'exists' : 'missing',
    });
    if (!exists) {
      blockers.push(`Missing directory: ${dir}`);
    }
  }

  // Check runtime shell files
  for (const file of REQUIRED_GD_FILES) {
    const fullPath = path.join(targetPath, file);
    const exists = fs.existsSync(fullPath);
    checks.push({
      check: `runtime:${file}`,
      pass: exists,
      detail: exists ? 'exists' : 'missing',
    });
    if (!exists) {
      blockers.push(`Missing runtime file: ${file}`);
    }
  }

  // Check canon vault directories
  const vaultPath = path.join(targetPath, 'canon');
  const vaultExists = fs.existsSync(vaultPath);
  checks.push({
    check: 'canon:vault_root',
    pass: vaultExists,
    detail: vaultExists ? 'exists' : 'missing',
  });

  if (vaultExists) {
    for (const dir of CANON_DIRS) {
      const fullPath = path.join(vaultPath, dir);
      const exists = fs.existsSync(fullPath);
      checks.push({
        check: `canon:${dir}`,
        pass: exists,
        detail: exists ? 'exists' : 'missing',
      });
      if (!exists) {
        warnings.push(`Missing canon directory: ${dir}`);
      }
    }
  } else {
    blockers.push('Canon vault not seeded');
  }

  // Check proof shell in registry
  const suites = db.prepare(
    'SELECT COUNT(*) as count FROM proof_suites WHERE project_id = ?'
  ).get(projectId) as { count: number };

  const proofPresent = suites.count > 0;
  checks.push({
    check: 'proof:suites',
    pass: proofPresent,
    detail: proofPresent ? `${suites.count} suites registered` : 'no suites',
  });

  if (!proofPresent) {
    blockers.push('Proof shell not installed');
  }

  const pass = blockers.length === 0;
  let next_action = 'project_ready';
  if (!pass) {
    if (blockers.some(b => b.includes('runtime'))) {
      next_action = 'install_runtime_shell';
    } else if (blockers.some(b => b.includes('Canon'))) {
      next_action = 'seed_vault';
    } else if (blockers.some(b => b.includes('Proof'))) {
      next_action = 'install_proof_shell';
    } else {
      next_action = 'install_runtime_shell';
    }
  }

  return {
    project_id: projectId,
    pass,
    checks,
    blockers,
    warnings,
    next_action,
  };
}
