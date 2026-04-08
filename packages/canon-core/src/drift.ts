import type Database from 'better-sqlite3';
import type { CanonPageRow, CanonDriftReportRow } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface DriftDetail {
  field: string;
  canon_value: unknown;
  registry_value: unknown;
  severity: 'drift' | 'warning';
}

export interface DriftResult {
  result: 'clean' | 'drift' | 'warning';
  scope_type: string;
  scope_id: string;
  details: DriftDetail[];
}

/**
 * Compare canon page claims vs registry truth for a given scope.
 * - character: checks variant count matches canon variant_ids
 * - encounter: checks route_tag, unit count
 * - chapter: checks encounter count
 */
export function detectDrift(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
): DriftResult {
  const details: DriftDetail[] = [];

  if (scopeType === 'character') {
    detectCharacterDrift(db, projectId, scopeId, details);
  } else if (scopeType === 'encounter') {
    detectEncounterDrift(db, projectId, scopeId, details);
  } else if (scopeType === 'chapter') {
    detectChapterDrift(db, projectId, scopeId, details);
  }

  const hasDrift = details.some((d) => d.severity === 'drift');
  const hasWarning = details.some((d) => d.severity === 'warning');
  const result: DriftResult['result'] = hasDrift ? 'drift' : hasWarning ? 'warning' : 'clean';

  // Write drift report
  const reportId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO canon_drift_reports (id, project_id, scope_type, scope_id, result, details_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(reportId, projectId, scopeType, scopeId, result, JSON.stringify(details));

  return { result, scope_type: scopeType, scope_id: scopeId, details };
}

function detectCharacterDrift(
  db: Database.Database,
  projectId: string,
  characterId: string,
  details: DriftDetail[],
): void {
  // Find canon page(s) linked to this character
  const links = db.prepare(
    "SELECT * FROM canon_links WHERE target_type = 'character' AND target_id = ? AND project_id = ?",
  ).all(characterId, projectId) as Array<{ source_canon_id: string }>;

  if (links.length === 0) return;

  const canonPage = db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?')
    .get(links[0].source_canon_id) as CanonPageRow | undefined;

  if (!canonPage || !canonPage.frontmatter_json) return;

  const fm = JSON.parse(canonPage.frontmatter_json);

  // Check variant count
  const registryVariants = db.prepare(
    'SELECT COUNT(*) as count FROM variants WHERE character_id = ?',
  ).get(characterId) as { count: number };

  const canonVariantIds = fm.variant_ids as string[] | undefined;
  if (canonVariantIds && canonVariantIds.length !== registryVariants.count) {
    details.push({
      field: 'variant_count',
      canon_value: canonVariantIds.length,
      registry_value: registryVariants.count,
      severity: 'drift',
    });
  }
}

function detectEncounterDrift(
  db: Database.Database,
  projectId: string,
  encounterId: string,
  details: DriftDetail[],
): void {
  const links = db.prepare(
    "SELECT * FROM canon_links WHERE target_type = 'encounter' AND target_id = ? AND project_id = ?",
  ).all(encounterId, projectId) as Array<{ source_canon_id: string }>;

  if (links.length === 0) return;

  const canonPage = db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?')
    .get(links[0].source_canon_id) as CanonPageRow | undefined;

  if (!canonPage || !canonPage.frontmatter_json) return;

  const fm = JSON.parse(canonPage.frontmatter_json);

  // Check route_tag
  const encounter = db.prepare('SELECT * FROM encounters WHERE id = ?').get(encounterId) as
    | { route_tag: string | null }
    | undefined;

  if (encounter && fm.route_tag && encounter.route_tag !== fm.route_tag) {
    details.push({
      field: 'route_tag',
      canon_value: fm.route_tag,
      registry_value: encounter.route_tag,
      severity: 'drift',
    });
  }

  // Check unit count
  if (fm.unit_count !== undefined) {
    const enemyCount = db.prepare(
      'SELECT COUNT(*) as count FROM encounter_enemies WHERE encounter_id = ?',
    ).get(encounterId) as { count: number };

    if (fm.unit_count !== enemyCount.count) {
      details.push({
        field: 'unit_count',
        canon_value: fm.unit_count,
        registry_value: enemyCount.count,
        severity: 'warning',
      });
    }
  }
}

function detectChapterDrift(
  db: Database.Database,
  projectId: string,
  chapterId: string,
  details: DriftDetail[],
): void {
  const links = db.prepare(
    "SELECT * FROM canon_links WHERE target_type = 'chapter' AND target_id = ? AND project_id = ?",
  ).all(chapterId, projectId) as Array<{ source_canon_id: string }>;

  if (links.length === 0) return;

  const canonPage = db.prepare('SELECT * FROM canon_pages WHERE canon_id = ?')
    .get(links[0].source_canon_id) as CanonPageRow | undefined;

  if (!canonPage || !canonPage.frontmatter_json) return;

  const fm = JSON.parse(canonPage.frontmatter_json);

  // Check encounter count
  if (fm.encounter_count !== undefined) {
    const registryCount = db.prepare(
      'SELECT COUNT(*) as count FROM encounters WHERE chapter = ? AND project_id = ?',
    ).get(chapterId, projectId) as { count: number };

    if (fm.encounter_count !== registryCount.count) {
      details.push({
        field: 'encounter_count',
        canon_value: fm.encounter_count,
        registry_value: registryCount.count,
        severity: 'drift',
      });
    }
  }
}
