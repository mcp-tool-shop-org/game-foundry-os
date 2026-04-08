import type Database from 'better-sqlite3';

export interface CanonTimelineEntry {
  timestamp: string;
  type: 'sync' | 'link' | 'snapshot' | 'drift' | 'handoff' | 'status_change';
  summary: string;
  detail: Record<string, unknown>;
}

/**
 * Merge sync events, link events, snapshot events, drift reports, and handoff generation
 * into a chronological timeline for a canon page.
 */
export function getCanonTimeline(
  db: Database.Database,
  projectId: string,
  canonId: string,
): CanonTimelineEntry[] {
  const entries: CanonTimelineEntry[] = [];

  // Sync events (state_events related to vault sync)
  const syncEvents = db.prepare(`
    SELECT * FROM state_events
    WHERE project_id = ? AND entity_type = 'vault'
    ORDER BY created_at
  `).all(projectId) as Array<{
    to_state: string;
    reason: string | null;
    payload_json: string | null;
    created_at: string;
  }>;

  for (const e of syncEvents) {
    entries.push({
      timestamp: e.created_at,
      type: 'sync',
      summary: e.reason ?? `Vault ${e.to_state}`,
      detail: e.payload_json ? JSON.parse(e.payload_json) : {},
    });
  }

  // Link events
  const links = db.prepare(`
    SELECT * FROM canon_links WHERE source_canon_id = ? AND project_id = ? ORDER BY created_at
  `).all(canonId, projectId) as Array<{
    id: string;
    target_type: string;
    target_id: string;
    link_type: string;
    created_at: string;
  }>;

  for (const link of links) {
    entries.push({
      timestamp: link.created_at,
      type: 'link',
      summary: `Linked to ${link.target_type}:${link.target_id} (${link.link_type})`,
      detail: { link_id: link.id, target_type: link.target_type, target_id: link.target_id },
    });
  }

  // Snapshots
  const snapshots = db.prepare(`
    SELECT * FROM canon_snapshots WHERE canon_id = ? AND project_id = ? ORDER BY created_at
  `).all(canonId, projectId) as Array<{
    id: string;
    content_hash: string;
    created_at: string;
  }>;

  for (const snap of snapshots) {
    entries.push({
      timestamp: snap.created_at,
      type: 'snapshot',
      summary: `Snapshot created (hash: ${snap.content_hash.slice(0, 8)})`,
      detail: { snapshot_id: snap.id, content_hash: snap.content_hash },
    });
  }

  // Drift reports — find via links from this canon page
  const linkedTargets = db.prepare(`
    SELECT target_type, target_id FROM canon_links WHERE source_canon_id = ? AND project_id = ?
  `).all(canonId, projectId) as Array<{ target_type: string; target_id: string }>;

  for (const target of linkedTargets) {
    const drifts = db.prepare(`
      SELECT * FROM canon_drift_reports
      WHERE scope_type = ? AND scope_id = ? AND project_id = ?
      ORDER BY created_at
    `).all(target.target_type, target.target_id, projectId) as Array<{
      id: string;
      result: string;
      details_json: string | null;
      created_at: string;
    }>;

    for (const drift of drifts) {
      entries.push({
        timestamp: drift.created_at,
        type: 'drift',
        summary: `Drift check: ${drift.result} (${target.target_type}:${target.target_id})`,
        detail: {
          report_id: drift.id,
          result: drift.result,
          details: drift.details_json ? JSON.parse(drift.details_json) : [],
        },
      });
    }
  }

  // Handoff artifacts
  for (const target of linkedTargets) {
    const handoffs = db.prepare(`
      SELECT * FROM handoff_artifacts
      WHERE scope_type = ? AND scope_id = ? AND project_id = ?
      ORDER BY created_at
    `).all(target.target_type, target.target_id, projectId) as Array<{
      id: string;
      artifact_type: string;
      output_path: string | null;
      created_at: string;
    }>;

    for (const h of handoffs) {
      entries.push({
        timestamp: h.created_at,
        type: 'handoff',
        summary: `Handoff generated: ${h.artifact_type}`,
        detail: { artifact_id: h.id, artifact_type: h.artifact_type, output_path: h.output_path },
      });
    }
  }

  // Sort chronologically
  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return entries;
}
