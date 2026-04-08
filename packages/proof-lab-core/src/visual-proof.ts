import type Database from 'better-sqlite3';
import type { ProofRunRow, VariantRow } from '@mcptoolshop/game-foundry-registry';
import { createProofRun, addAssertion } from './runs.js';
import { packAlbedoDir, DIRECTIONS } from '@mcptoolshop/engine-bridge-mcp/lib';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

export interface VisualSuiteResult {
  run: ProofRunRow;
  passed: boolean;
  assertions: Array<{ key: string; status: string; message: string }>;
}

/** Configuration for visual checks */
export interface VisualCheckConfig {
  target_tile_size: number;     // Expected tile size (e.g. 96)
  min_occupancy: number;        // Minimum % of canvas that should be filled (e.g. 0.30)
  max_occupancy: number;        // Maximum % (e.g. 0.95 — too full means no transparency)
  min_dimension: number;        // Minimum sprite dimension (e.g. 32)
  max_dimension: number;        // Maximum sprite dimension (e.g. 256)
  fringe_tolerance: number;     // Max semi-opaque border pixels before flagging halo (e.g. 20)
}

const DEFAULT_CONFIG: VisualCheckConfig = {
  target_tile_size: 96,
  min_occupancy: 0.25,
  max_occupancy: 0.95,
  min_dimension: 32,
  max_dimension: 256,
  fringe_tolerance: 20,
};

// ─── Individual pixel-level checks ─────────────────────────

export interface SpriteCheckResult {
  file: string;
  width: number;
  height: number;
  has_alpha: boolean;
  corners_transparent: boolean;
  border_transparent_pct: number;
  occupancy: number;              // % of non-transparent pixels
  bbox: { x: number; y: number; w: number; h: number };
  fringe_pixels: number;          // Semi-opaque border pixels (halo indicator)
  avg_luminance: number;          // Average brightness of visible pixels (0-255)
  issues: string[];
}

/**
 * Check a single sprite PNG for visual integrity.
 * Reads the actual pixels — no shortcuts.
 */
export function checkSprite(filePath: string, config: VisualCheckConfig = DEFAULT_CONFIG): SpriteCheckResult {
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  const { width, height } = png;
  const issues: string[] = [];

  let hasAlpha = false;
  let transparentCount = 0;
  let opaqueCount = 0;
  let semiOpaqueCount = 0;
  let luminanceSum = 0;
  let visibleCount = 0;

  // Bounding box of non-transparent pixels
  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      const a = png.data[idx + 3];

      if (a === 0) {
        transparentCount++;
        hasAlpha = true;
      } else if (a === 255) {
        opaqueCount++;
        luminanceSum += (r * 0.299 + g * 0.587 + b * 0.114);
        visibleCount++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else {
        semiOpaqueCount++;
        hasAlpha = true;
        visibleCount++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const totalPixels = width * height;
  const occupancy = visibleCount / totalPixels;

  // Corner transparency check (all 4 corners)
  const cornerPositions = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const cornersTransparent = cornerPositions.every(([cx, cy]) => {
    const idx = (cy * width + cx) * 4;
    return png.data[idx + 3] === 0;
  });

  // Border transparency: check all edge pixels
  let borderTotal = 0;
  let borderTransparent = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      borderTotal++;
      const idx = (y * width + x) * 4;
      if (png.data[idx + 3] === 0) borderTransparent++;
    }
  }
  for (let y = 1; y < height - 1; y++) {
    for (const x of [0, width - 1]) {
      borderTotal++;
      const idx = (y * width + x) * 4;
      if (png.data[idx + 3] === 0) borderTransparent++;
    }
  }
  const borderTransparentPct = borderTotal > 0 ? borderTransparent / borderTotal : 0;

  // Fringe detection: count semi-opaque pixels in the outer 2px ring
  let fringePixels = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < 2 || x >= width - 2 || y < 2 || y >= height - 2) {
        const idx = (y * width + x) * 4;
        const a = png.data[idx + 3];
        if (a > 0 && a < 255) fringePixels++;
      }
    }
  }

  const bbox = visibleCount > 0
    ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
    : { x: 0, y: 0, w: 0, h: 0 };

  const avgLuminance = visibleCount > 0 ? luminanceSum / visibleCount : 0;

  // ─── Issue detection ──────────────────────────────────────

  // 1. Transparency
  if (!hasAlpha || transparentCount === 0) {
    issues.push('background_not_transparent');
  } else if (!cornersTransparent) {
    issues.push('corners_not_transparent');
  }
  if (borderTransparentPct < 0.5) {
    issues.push('border_mostly_opaque');
  }

  // 2. Occupancy
  if (occupancy < config.min_occupancy) {
    issues.push(`occupancy_too_low:${(occupancy * 100).toFixed(0)}%`);
  }
  if (occupancy > config.max_occupancy) {
    issues.push(`occupancy_too_high:${(occupancy * 100).toFixed(0)}%`);
  }

  // 3. Tile fit
  if (width < config.min_dimension || height < config.min_dimension) {
    issues.push(`too_small:${width}x${height}`);
  }
  if (width > config.max_dimension || height > config.max_dimension) {
    issues.push(`too_large:${width}x${height}`);
  }

  // 4. Fringe / halo
  if (fringePixels > config.fringe_tolerance) {
    issues.push(`matte_fringe:${fringePixels}px`);
  }

  // 5. Contrast (very dark sprites on dark backgrounds)
  if (avgLuminance < 40 && visibleCount > 0) {
    issues.push(`low_luminance:${avgLuminance.toFixed(0)}`);
  }

  // 6. Import sidecar check — warn if .import file is missing (Godot won't load it)
  const importPath = filePath + '.import';
  if (!fs.existsSync(importPath) && filePath.includes('assets')) {
    issues.push('warn:missing_import_sidecar');
  }

  // 7. Silhouette integrity — if bbox is much smaller than canvas
  if (visibleCount > 0) {
    const bboxArea = bbox.w * bbox.h;
    const bboxOccupancy = visibleCount / bboxArea;
    if (bboxOccupancy < 0.15) {
      issues.push('fragmented_silhouette');
    }
  }

  return {
    file: filePath,
    width, height,
    has_alpha: hasAlpha,
    corners_transparent: cornersTransparent,
    border_transparent_pct: borderTransparentPct,
    occupancy,
    bbox,
    fringe_pixels: fringePixels,
    avg_luminance: avgLuminance,
    issues,
  };
}

/**
 * Run visual integrity proof suite for a variant or chapter.
 * This is a PROMOTION GATE — failure blocks advancement to runtime-ready.
 */
export function runVisualSuite(
  db: Database.Database,
  projectId: string,
  scopeType: string,
  scopeId: string,
  projectRoot: string,
  config: VisualCheckConfig = DEFAULT_CONFIG,
): VisualSuiteResult {
  const assertions: Array<{ key: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

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
      assertions.push({ key: `${variant.id}_pack_id`, status: 'warn', message: `${variant.id}: no pack ID, skipping visual check` });
      continue;
    }

    const albedoDir = packAlbedoDir(projectRoot, packId, variant.id);
    if (!fs.existsSync(albedoDir)) {
      assertions.push({ key: `${variant.id}_albedo_dir`, status: 'fail', message: `${variant.id}: albedo directory not found at ${albedoDir}` });
      continue;
    }

    let variantPassed = true;
    let checkedCount = 0;

    for (const dir of DIRECTIONS) {
      const spritePath = path.join(albedoDir, `${dir}.png`);
      if (!fs.existsSync(spritePath)) continue;

      checkedCount++;
      const result = checkSprite(spritePath, config);

      // Separate hard failures from warnings
      const hardIssues = result.issues.filter(i => !i.startsWith('warn:') && !i.startsWith('matte_fringe') && !i.startsWith('low_luminance'));
      const softIssues = result.issues.filter(i => i.startsWith('warn:') || i.startsWith('matte_fringe') || i.startsWith('low_luminance'));

      if (hardIssues.length === 0 && softIssues.length === 0) {
        if (dir === 'front') {
          assertions.push({
            key: `${variant.id}_${dir}_visual`,
            status: 'pass',
            message: `${variant.id}/${dir}: visual ok (${result.width}x${result.height}, ${(result.occupancy * 100).toFixed(0)}% fill, lum ${result.avg_luminance.toFixed(0)})`,
          });
        }
      } else {
        if (hardIssues.length > 0) variantPassed = false;
        for (const issue of hardIssues) {
          assertions.push({
            key: `${variant.id}_${dir}_${issue.split(':')[0]}`,
            status: 'fail',
            message: `${variant.id}/${dir}: ${issue}`,
          });
        }
        for (const issue of softIssues) {
          assertions.push({
            key: `${variant.id}_${dir}_${issue.replace('warn:', '').split(':')[0]}`,
            status: 'warn',
            message: `${variant.id}/${dir}: ${issue.replace('warn:', '')}`,
          });
        }
      }
    }

    if (checkedCount === 0) {
      assertions.push({ key: `${variant.id}_no_sprites`, status: 'fail', message: `${variant.id}: no sprite PNGs found in ${albedoDir}` });
    } else if (variantPassed) {
      assertions.push({ key: `${variant.id}_visual_ok`, status: 'pass', message: `${variant.id}: all ${checkedCount} directions pass visual checks` });
    }
  }

  const failures = assertions.filter(a => a.status === 'fail');
  const warnings = assertions.filter(a => a.status === 'warn');
  const result = failures.length > 0 ? 'fail' as const : 'pass' as const;

  const suite = ensureVisualSuite(db, projectId, scopeType);

  const run = createProofRun(db, {
    project_id: projectId,
    suite_id: suite,
    scope_type: scopeType,
    scope_id: scopeId,
    result,
    blocking_failures: failures.length,
    warning_count: warnings.length,
    summary: `Visual integrity: ${result} (${failures.length} failures, ${warnings.length} warnings, ${variants.length} variants)`,
    tool_name: 'proof_run_visual_suite',
  });

  for (const a of assertions) {
    addAssertion(db, run.id, a.key, a.status, a.message);
  }

  return { run, passed: result === 'pass', assertions };
}

function ensureVisualSuite(db: Database.Database, projectId: string, scopeType: string): string {
  const id = `suite_visual_${scopeType}`;
  const existing = db.prepare(
    'SELECT id FROM proof_suites WHERE project_id = ? AND suite_key = ? AND scope_type = ?'
  ).get(projectId, 'visual_integrity', scopeType) as { id: string } | undefined;

  if (existing) return existing.id;

  db.prepare(`
    INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, description, is_blocking)
    VALUES (?, ?, 'visual_integrity', ?, 'Visual Integrity', 'Validates sprite transparency, occupancy, tile fit, contrast, and silhouette integrity', 1)
  `).run(id, projectId, scopeType);

  return id;
}
