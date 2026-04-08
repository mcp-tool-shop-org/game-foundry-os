import type Database from 'better-sqlite3';
import type { HandoffArtifactRow, CanonPageRow } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface HandoffContent {
  scope_type: string;
  scope_id: string;
  artifact_type: string;
  generated_at: string;
  canon_summary: {
    page_count: number;
    pages: Array<{ canon_id: string; title: string; kind: string; status: string }>;
  };
  production_summary: Record<string, unknown>;
  proof_summary: Record<string, unknown>;
  freeze_summary: Record<string, unknown>;
  open_debt: string[];
}

/**
 * Build structured handoff object from: canon page content + production status
 * + proof status + freeze status + open debt. Writes handoff_artifacts row.
 * Optionally writes JSON to outputPath.
 */
export function generateHandoff(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
  artifactType: string,
  outputPath?: string,
): HandoffContent {
  // Gather canon pages linked to this scope
  const links = db.prepare(
    'SELECT * FROM canon_links WHERE target_type = ? AND target_id = ? AND project_id = ?',
  ).all(scopeType, scopeId, projectId) as Array<{ source_canon_id: string }>;

  const pages: Array<{ canon_id: string; title: string; kind: string; status: string }> = [];
  for (const link of links) {
    const page = db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?')
      .get(link.source_canon_id) as CanonPageRow | undefined;
    if (page) {
      pages.push({ canon_id: page.canon_id, title: page.title, kind: page.kind, status: page.status });
    }
  }

  // Production summary
  const productionSummary = getProductionSummary(db, scopeType, scopeId);

  // Proof summary
  const proofRuns = db.prepare(
    'SELECT * FROM proof_runs WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC LIMIT 5',
  ).all(scopeType, scopeId) as Array<{ id: string; result: string; created_at: string }>;

  const proofSummary = {
    latest_runs: proofRuns.map((r) => ({ id: r.id, result: r.result, created_at: r.created_at })),
    total_runs: proofRuns.length,
  };

  // Freeze summary
  const freezeReceipts = db.prepare(
    'SELECT * FROM freeze_receipts WHERE scope_type = ? AND scope_id = ? ORDER BY created_at DESC LIMIT 1',
  ).all(scopeType, scopeId) as Array<{ id: string; receipt_hash: string | null; created_at: string }>;

  const freezeSummary = {
    frozen: freezeReceipts.length > 0,
    latest_receipt: freezeReceipts[0] ?? null,
  };

  // Open debt: drift reports with non-clean results
  const driftReports = db.prepare(
    "SELECT * FROM canon_drift_reports WHERE scope_type = ? AND scope_id = ? AND result != 'clean' ORDER BY created_at DESC",
  ).all(scopeType, scopeId) as Array<{ result: string; details_json: string | null }>;

  const openDebt = driftReports.map((d) => {
    const details = d.details_json ? JSON.parse(d.details_json) : [];
    return `${d.result}: ${(details as Array<{ field: string }>).map((det) => det.field).join(', ')}`;
  });

  const handoff: HandoffContent = {
    scope_type: scopeType,
    scope_id: scopeId,
    artifact_type: artifactType,
    generated_at: new Date().toISOString(),
    canon_summary: { page_count: pages.length, pages },
    production_summary: productionSummary,
    proof_summary: proofSummary,
    freeze_summary: freezeSummary,
    open_debt: openDebt,
  };

  // Write to disk if path provided
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(handoff, null, 2), 'utf-8');
  }

  // Record handoff_artifacts row
  const contentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(handoff))
    .digest('hex')
    .slice(0, 16);

  const artifactId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO handoff_artifacts (id, project_id, scope_type, scope_id, artifact_type, output_path, content_hash, details_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(artifactId, projectId, scopeType, scopeId, artifactType, outputPath ?? null, contentHash, JSON.stringify(handoff));

  return handoff;
}

function getProductionSummary(
  db: Database.Database,
  scopeType: string,
  scopeId: string,
): Record<string, unknown> {
  if (scopeType === 'character') {
    const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(scopeId) as
      | Record<string, unknown>
      | undefined;
    if (!char) return { status: 'not_found' };
    return {
      concept_status: char.concept_status,
      directional_status: char.directional_status,
      sheet_status: char.sheet_status,
      pack_status: char.pack_status,
      portrait_status: char.portrait_status,
      integration_status: char.integration_status,
      freeze_status: char.freeze_status,
    };
  }

  if (scopeType === 'encounter') {
    const enc = db.prepare('SELECT * FROM encounters WHERE id = ?').get(scopeId) as
      | Record<string, unknown>
      | undefined;
    if (!enc) return { status: 'not_found' };
    return {
      production_state: enc.production_state,
      runtime_sync_state: enc.runtime_sync_state,
      bounds_valid: enc.bounds_valid,
      formation_valid: enc.formation_valid,
      variants_valid: enc.variants_valid,
    };
  }

  if (scopeType === 'chapter') {
    const encounters = db.prepare(
      'SELECT production_state, COUNT(*) as count FROM encounters WHERE chapter = ? GROUP BY production_state',
    ).all(scopeId) as Array<{ production_state: string; count: number }>;
    return { encounter_states: encounters };
  }

  return {};
}
