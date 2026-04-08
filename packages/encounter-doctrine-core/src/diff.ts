import type Database from 'better-sqlite3';
import type { EncounterExportRow } from '@mcptoolshop/game-foundry-registry';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

export interface DiffResult {
  encounter_id: string;
  canonical_hash: string | null;
  runtime_hash: string | null;
  status: 'match' | 'mismatch' | 'missing_export' | 'missing_runtime';
  manifest_path: string | null;
}

/**
 * Compare canonical export hash vs runtime file hash.
 * Reports match/mismatch/missing.
 */
export function diffManifestVsRuntime(
  db: Database.Database,
  encounterId: string,
  projectRoot: string,
): DiffResult {
  const canonicalExport = db.prepare(
    'SELECT * FROM encounter_exports WHERE encounter_id = ? AND is_canonical = 1 ORDER BY created_at DESC LIMIT 1',
  ).get(encounterId) as EncounterExportRow | undefined;

  if (!canonicalExport) {
    return {
      encounter_id: encounterId,
      canonical_hash: null,
      runtime_hash: null,
      status: 'missing_export',
      manifest_path: null,
    };
  }

  const manifestPath = canonicalExport.manifest_path;

  if (!fs.existsSync(manifestPath)) {
    return {
      encounter_id: encounterId,
      canonical_hash: canonicalExport.content_hash,
      runtime_hash: null,
      status: 'missing_runtime',
      manifest_path: manifestPath,
    };
  }

  const runtimeContent = fs.readFileSync(manifestPath, 'utf-8');
  const runtimeHash = createHash('sha256').update(runtimeContent).digest('hex').slice(0, 16);

  const match = canonicalExport.content_hash === runtimeHash;

  return {
    encounter_id: encounterId,
    canonical_hash: canonicalExport.content_hash,
    runtime_hash: runtimeHash,
    status: match ? 'match' : 'mismatch',
    manifest_path: manifestPath,
  };
}
