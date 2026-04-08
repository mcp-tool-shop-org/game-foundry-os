import type Database from 'better-sqlite3';

export interface CanonNextStepResult {
  action: string;
  reason: string;
  details: Record<string, unknown>;
}

/**
 * Check canon layer health and suggest the next action:
 * - No pages registered? -> sync_vault
 * - Unlinked pages? -> link_object
 * - Drift detected? -> fix_drift
 * - Stale sync? -> re-sync
 * - Missing required pages? -> create_page
 */
export function getCanonNextStep(
  db: Database.Database,
  projectId: string,
): CanonNextStepResult {
  // Check if any pages registered
  const pageCount = db.prepare(
    'SELECT COUNT(*) as count FROM canon_pages WHERE project_id = ?',
  ).get(projectId) as { count: number };

  if (pageCount.count === 0) {
    return {
      action: 'sync_vault',
      reason: 'No canon pages registered for this project',
      details: { page_count: 0 },
    };
  }

  // Check for unlinked pages (registered but no links FROM them)
  const unlinkedPages = db.prepare(`
    SELECT cp.canon_id, cp.title, cp.kind FROM canon_pages cp
    WHERE cp.project_id = ? AND cp.status = 'registered'
      AND NOT EXISTS (
        SELECT 1 FROM canon_links cl WHERE cl.source_canon_id = cp.canon_id AND cl.project_id = ?
      )
  `).all(projectId, projectId) as Array<{ canon_id: string; title: string; kind: string }>;

  if (unlinkedPages.length > 0) {
    return {
      action: 'link_object',
      reason: `${unlinkedPages.length} canon page(s) are not linked to any runtime object`,
      details: {
        unlinked_count: unlinkedPages.length,
        examples: unlinkedPages.slice(0, 5),
      },
    };
  }

  // Check for recent drift
  const recentDrift = db.prepare(`
    SELECT * FROM canon_drift_reports
    WHERE project_id = ? AND result != 'clean'
    ORDER BY created_at DESC LIMIT 5
  `).all(projectId) as Array<{ scope_type: string; scope_id: string; result: string }>;

  if (recentDrift.length > 0) {
    return {
      action: 'fix_drift',
      reason: `${recentDrift.length} drift issue(s) detected`,
      details: {
        drift_count: recentDrift.length,
        scopes: recentDrift.map((d) => `${d.scope_type}:${d.scope_id} (${d.result})`),
      },
    };
  }

  // Check for missing required pages (characters without canon pages)
  const charactersWithoutCanon = db.prepare(`
    SELECT c.id, c.display_name FROM characters c
    WHERE c.project_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM canon_links cl
        WHERE cl.target_type = 'character' AND cl.target_id = c.id AND cl.project_id = ?
      )
  `).all(projectId, projectId) as Array<{ id: string; display_name: string }>;

  if (charactersWithoutCanon.length > 0) {
    return {
      action: 'create_page',
      reason: `${charactersWithoutCanon.length} character(s) have no canon page`,
      details: {
        missing_count: charactersWithoutCanon.length,
        examples: charactersWithoutCanon.slice(0, 5),
      },
    };
  }

  // Check for encounters without canon pages
  const encountersWithoutCanon = db.prepare(`
    SELECT e.id, e.label FROM encounters e
    WHERE e.project_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM canon_links cl
        WHERE cl.target_type = 'encounter' AND cl.target_id = e.id AND cl.project_id = ?
      )
  `).all(projectId, projectId) as Array<{ id: string; label: string }>;

  if (encountersWithoutCanon.length > 0) {
    return {
      action: 'create_page',
      reason: `${encountersWithoutCanon.length} encounter(s) have no canon page`,
      details: {
        missing_count: encountersWithoutCanon.length,
        examples: encountersWithoutCanon.slice(0, 5),
      },
    };
  }

  return {
    action: 'none',
    reason: 'Canon layer is healthy — all pages registered, linked, and drift-free',
    details: { page_count: pageCount.count },
  };
}
