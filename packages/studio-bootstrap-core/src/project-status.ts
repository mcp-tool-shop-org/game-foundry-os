import type Database from 'better-sqlite3';
import type { ProjectStatusResult } from '@mcptoolshop/game-foundry-registry';
import { getLatestBootstrap } from './bootstrap.js';

export function getProjectStatus(db: Database.Database, projectId: string): ProjectStatusResult {
  const bootstrap = getLatestBootstrap(db, projectId);

  // Check canon pages
  const canonCount = (db.prepare(
    'SELECT COUNT(*) as count FROM canon_pages WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  // Check proof suites
  const suiteCount = (db.prepare(
    'SELECT COUNT(*) as count FROM proof_suites WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  // Check freeze policies
  const policyCount = (db.prepare(
    'SELECT COUNT(*) as count FROM freeze_policies WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  const canon_seeded = canonCount > 0;
  const registry_seeded = suiteCount > 0 && policyCount > 0;
  const runtime_shell_installed = bootstrap?.result === 'pass';
  const proof_shell_installed = suiteCount > 0;

  let template_used: string | null = null;
  if (bootstrap?.template_id) {
    const tmpl = db.prepare(
      'SELECT template_key FROM project_templates WHERE id = ?'
    ).get(bootstrap.template_id) as { template_key: string } | undefined;
    template_used = tmpl?.template_key ?? null;
  }

  let next_step = 'project_ready';
  if (!bootstrap) {
    next_step = 'bootstrap_template';
  } else if (bootstrap.result === 'pending') {
    next_step = 'complete_bootstrap';
  } else if (!canon_seeded) {
    next_step = 'seed_vault';
  } else if (!registry_seeded) {
    next_step = 'seed_registry';
  } else if (!proof_shell_installed) {
    next_step = 'install_proof_shell';
  }

  return {
    project_id: projectId,
    template_used,
    bootstrap_result: bootstrap?.result ?? null,
    canon_seeded,
    registry_seeded,
    runtime_shell_installed,
    proof_shell_installed,
    next_step,
  };
}
