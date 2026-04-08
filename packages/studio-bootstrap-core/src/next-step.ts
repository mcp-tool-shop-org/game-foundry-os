import type Database from 'better-sqlite3';
import { getLatestBootstrap } from './bootstrap.js';

export interface StudioNextStep {
  action: string;
  reason: string;
  priority: 'critical' | 'normal' | 'low';
}

export function getStudioNextStep(db: Database.Database, projectId: string): StudioNextStep {
  // Check if project exists
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    return {
      action: 'create_project',
      reason: 'Project does not exist in registry',
      priority: 'critical',
    };
  }

  // Check bootstrap status
  const bootstrap = getLatestBootstrap(db, projectId);
  if (!bootstrap) {
    return {
      action: 'bootstrap_template',
      reason: 'No bootstrap record found — run full template bootstrap',
      priority: 'critical',
    };
  }

  if (bootstrap.result === 'pending') {
    return {
      action: 'complete_bootstrap',
      reason: 'Bootstrap started but not completed',
      priority: 'critical',
    };
  }

  if (bootstrap.result === 'fail') {
    return {
      action: 'retry_bootstrap',
      reason: 'Previous bootstrap failed — review errors and retry',
      priority: 'critical',
    };
  }

  // Check canon vault
  const canonCount = (db.prepare(
    'SELECT COUNT(*) as count FROM canon_pages WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (canonCount === 0) {
    return {
      action: 'seed_vault',
      reason: 'Canon vault not seeded — no design documentation pages exist',
      priority: 'normal',
    };
  }

  // Check proof suites
  const suiteCount = (db.prepare(
    'SELECT COUNT(*) as count FROM proof_suites WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (suiteCount === 0) {
    return {
      action: 'install_proof_shell',
      reason: 'No proof suites registered — verification pipeline not configured',
      priority: 'normal',
    };
  }

  // Check freeze policies
  const policyCount = (db.prepare(
    'SELECT COUNT(*) as count FROM freeze_policies WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (policyCount === 0) {
    return {
      action: 'seed_registry',
      reason: 'No freeze policies — governance not configured',
      priority: 'normal',
    };
  }

  // Check characters
  const charCount = (db.prepare(
    'SELECT COUNT(*) as count FROM characters WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (charCount === 0) {
    return {
      action: 'create_character',
      reason: 'No characters registered — create your first character to begin production',
      priority: 'normal',
    };
  }

  // Check encounters
  const encounterCount = (db.prepare(
    'SELECT COUNT(*) as count FROM encounters WHERE project_id = ?'
  ).get(projectId) as { count: number }).count;

  if (encounterCount === 0) {
    return {
      action: 'create_encounter',
      reason: 'No encounters defined — create your first encounter to test combat',
      priority: 'normal',
    };
  }

  return {
    action: 'continue_production',
    reason: 'All bootstrap shells installed — continue with sprite and encounter production',
    priority: 'low',
  };
}
