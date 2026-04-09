import type Database from 'better-sqlite3';
import type { ProofRunRow, VariantRow } from '@mcptoolshop/game-foundry-registry';
import { getRenderDoctrineOrDefaults } from '@mcptoolshop/game-foundry-registry';
import { createProofRun, addAssertion } from './runs.js';
import { checkSprite } from './visual-proof.js';
import { packAlbedoDir } from '@mcptoolshop/engine-bridge-mcp/lib';
import fs from 'node:fs';
import path from 'node:path';

export interface BoardCompositeSuiteResult {
  run: ProofRunRow;
  passed: boolean;
  assertions: Array<{ key: string; status: string; message: string }>;
}

interface BoardBackground {
  name: string;
  avg_luminance: number;
  contrast_multiplier: number;
}

const BOARD_BACKGROUNDS: BoardBackground[] = [
  { name: 'dark',  avg_luminance: 30,  contrast_multiplier: 1.0 },
  { name: 'mid',   avg_luminance: 128, contrast_multiplier: 1.0 },
  { name: 'noisy', avg_luminance: 100, contrast_multiplier: 0.75 },
];

/**
 * Run board composite proof suite — tests sprite visibility against simulated
 * board backgrounds (dark, mid, noisy). Checks contrast survival, gameplay
 * scale readability, silhouette survival, and alpha correctness.
 *
 * This is a BLOCKING gate — sprites that can't survive the board can't ship.
 */
export function runBoardCompositeSuite(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
  projectRoot: string,
): BoardCompositeSuiteResult {
  const assertions: Array<{ key: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

  const doctrine = getRenderDoctrineOrDefaults(db, projectId);
  const minContrast = doctrine.min_board_contrast;
  const activeBgNames: string[] = JSON.parse(doctrine.board_test_backgrounds_json);
  const activeBackgrounds = BOARD_BACKGROUNDS.filter(b => activeBgNames.includes(b.name));
  const targetHeights: Record<string, number> = JSON.parse(doctrine.target_heights_json);
  const minTargetHeight = Math.min(...Object.values(targetHeights));

  const variants: VariantRow[] = scopeType === 'variant'
    ? [db.prepare('SELECT * FROM variants WHERE id = ?').get(scopeId) as VariantRow].filter(Boolean)
    : db.prepare(`
        SELECT v.* FROM variants v
        JOIN characters c ON v.character_id = c.id
        WHERE c.project_id = ? AND c.chapter_primary = ?
      `).all(projectId, scopeId) as VariantRow[];

  if (variants.length === 0) {
    assertions.push({ key: 'variants_found', status: 'fail', message: `No variants found for ${scopeType}:${scopeId}` });
  }

  for (const variant of variants) {
    const packId = variant.pack_id ?? variant.canonical_pack_name ?? '';
    if (!packId) {
      assertions.push({ key: `${variant.id}_pack_id`, status: 'warn', message: `${variant.id}: no pack ID, skipping board composite` });
      continue;
    }

    const albedoDir = packAlbedoDir(projectRoot, packId, variant.id);
    const frontPath = path.join(albedoDir, 'front.png');

    if (!fs.existsSync(frontPath)) {
      assertions.push({ key: `${variant.id}_front_missing`, status: 'fail', message: `${variant.id}: front.png not found for board composite test` });
      continue;
    }

    const sprite = checkSprite(frontPath);

    // Board contrast checks per background
    for (const bg of activeBackgrounds) {
      const delta = Math.abs(sprite.avg_luminance - bg.avg_luminance);
      const threshold = minContrast * bg.contrast_multiplier;
      const passes = delta >= threshold;

      assertions.push({
        key: `${variant.id}_${bg.name}_contrast`,
        status: passes ? 'pass' : 'fail',
        message: passes
          ? `${variant.id}: survives ${bg.name} background (delta ${delta.toFixed(0)} >= ${threshold.toFixed(0)})`
          : `${variant.id}: fails ${bg.name} background (delta ${delta.toFixed(0)} < ${threshold.toFixed(0)}, sprite lum ${sprite.avg_luminance.toFixed(0)} vs bg ${bg.avg_luminance})`,
      });
    }

    // Gameplay scale check
    const maxDim = Math.max(sprite.width, sprite.height);
    const scaleOk = maxDim >= minTargetHeight * 0.5;
    assertions.push({
      key: `${variant.id}_gameplay_scale`,
      status: scaleOk ? 'pass' : 'warn',
      message: scaleOk
        ? `${variant.id}: gameplay scale ok (${maxDim}px >= ${Math.floor(minTargetHeight * 0.5)}px min)`
        : `${variant.id}: may be too small for gameplay (${maxDim}px < ${Math.floor(minTargetHeight * 0.5)}px min)`,
    });

    // Silhouette dark survival — enough visible pixels to read at all
    const silhouetteOk = sprite.occupancy >= doctrine.occupancy_min;
    assertions.push({
      key: `${variant.id}_silhouette_survival`,
      status: silhouetteOk ? 'pass' : 'fail',
      message: silhouetteOk
        ? `${variant.id}: silhouette occupancy ${(sprite.occupancy * 100).toFixed(0)}% >= ${(doctrine.occupancy_min * 100).toFixed(0)}%`
        : `${variant.id}: silhouette too sparse (${(sprite.occupancy * 100).toFixed(0)}% < ${(doctrine.occupancy_min * 100).toFixed(0)}%)`,
    });

    // Alpha correctness — check for premultiplied artifacts in straight-alpha export
    if (doctrine.alpha_policy === 'straight') {
      // A premultiplied artifact is visible as non-zero RGB with zero alpha
      // We already have has_alpha from checkSprite; a basic check is fringe detection
      const alphaClean = sprite.fringe_pixels <= 20; // doctrine fringe tolerance
      assertions.push({
        key: `${variant.id}_alpha_correctness`,
        status: alphaClean ? 'pass' : 'warn',
        message: alphaClean
          ? `${variant.id}: alpha edges clean (${sprite.fringe_pixels} fringe pixels)`
          : `${variant.id}: possible alpha fringe (${sprite.fringe_pixels} semi-opaque edge pixels)`,
      });
    }
  }

  const failures = assertions.filter(a => a.status === 'fail');
  const warnings = assertions.filter(a => a.status === 'warn');
  const result = failures.length > 0 ? 'fail' as const : 'pass' as const;

  const suiteId = ensureBoardCompositeSuite(db, projectId, scopeType);

  const run = createProofRun(db, {
    project_id: projectId,
    suite_id: suiteId,
    scope_type: scopeType,
    scope_id: scopeId,
    result,
    blocking_failures: failures.length,
    warning_count: warnings.length,
    summary: `Board composite: ${result} (${failures.length} failures, ${warnings.length} warnings, ${variants.length} variants)`,
    tool_name: 'proof_run_board_composite',
  });

  for (const a of assertions) {
    addAssertion(db, run.id, a.key, a.status, a.message);
  }

  return { run, passed: result === 'pass', assertions };
}

function ensureBoardCompositeSuite(db: Database.Database, projectId: string, scopeType: string): string {
  const id = `suite_board_composite_${scopeType}`;
  const existing = db.prepare(
    'SELECT id FROM proof_suites WHERE project_id = ? AND suite_key = ? AND scope_type = ?'
  ).get(projectId, 'board_composite', scopeType) as { id: string } | undefined;

  if (existing) return existing.id;

  db.prepare(`
    INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, description, is_blocking)
    VALUES (?, ?, 'board_composite', ?, 'Board Composite', 'Tests sprite visibility against simulated board backgrounds — contrast, scale, silhouette survival, alpha correctness', 1)
  `).run(id, projectId, scopeType);

  return id;
}
