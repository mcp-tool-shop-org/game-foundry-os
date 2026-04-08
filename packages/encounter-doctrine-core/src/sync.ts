import type Database from 'better-sqlite3';
import type { EncounterSyncReceiptRow, EncounterExportRow } from '@mcptoolshop/game-foundry-registry';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface SyncResult {
  receipt_id: string;
  encounter_id: string;
  target_path: string;
  synced_files: string[];
  verification_status: string;
}

/**
 * Copy manifest to runtime path, verify, write encounter_sync_receipts row.
 */
export function syncToEngine(
  db: Database.Database,
  encounterId: string,
  projectId: string,
  targetRuntimePath: string,
): SyncResult {
  // Get canonical export
  const canonicalExport = db.prepare(
    'SELECT * FROM encounter_exports WHERE encounter_id = ? AND is_canonical = 1 ORDER BY created_at DESC LIMIT 1',
  ).get(encounterId) as EncounterExportRow | undefined;

  if (!canonicalExport) {
    throw new Error(`No canonical export found for encounter ${encounterId}. Export manifest first.`);
  }

  // Read the export manifest from its path or from payload
  let manifestContent: string;
  if (canonicalExport.export_payload_json) {
    manifestContent = canonicalExport.export_payload_json;
  } else if (fs.existsSync(canonicalExport.manifest_path)) {
    manifestContent = fs.readFileSync(canonicalExport.manifest_path, 'utf-8');
  } else {
    throw new Error(`Manifest file not found at ${canonicalExport.manifest_path}`);
  }

  // Ensure target dir exists
  const resolvedTarget = path.resolve(targetRuntimePath);
  const targetDir = path.dirname(resolvedTarget);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write manifest to runtime path
  fs.writeFileSync(resolvedTarget, manifestContent, 'utf-8');

  // Verify file was written
  const written = fs.existsSync(resolvedTarget);
  const verificationStatus = written ? 'verified' : 'failed';

  const syncedFiles = [resolvedTarget];
  const receiptHash = createHash('sha256').update(manifestContent).digest('hex').slice(0, 16);

  // Write sync receipt
  const receiptId = randomUUID();
  db.prepare(`
    INSERT INTO encounter_sync_receipts (id, encounter_id, project_id, target_path, synced_files_json, verification_status, receipt_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(receiptId, encounterId, projectId, resolvedTarget, JSON.stringify(syncedFiles), verificationStatus, receiptHash);

  return {
    receipt_id: receiptId,
    encounter_id: encounterId,
    target_path: resolvedTarget,
    synced_files: syncedFiles,
    verification_status: verificationStatus,
  };
}

/** Get sync receipt history */
export function getSyncReceipts(
  db: Database.Database,
  encounterId: string,
): EncounterSyncReceiptRow[] {
  return db.prepare(
    'SELECT * FROM encounter_sync_receipts WHERE encounter_id = ? ORDER BY created_at ASC',
  ).all(encounterId) as EncounterSyncReceiptRow[];
}
