import fs from 'node:fs';
import path from 'node:path';
import type { VariantRow, ValidationResult } from '@mcptoolshop/game-foundry-registry';
import { conceptDir, directionalDir, DIRECTIONAL_DIRS, sheetDir, packAssetDir, PACK_DIRECTIONS } from './paths.js';

/**
 * Check filesystem presence for each pipeline stage of a variant.
 */
export function checkVariantCompleteness(
  rootPath: string,
  variant: VariantRow,
): ValidationResult[] {
  const checks: ValidationResult[] = [];

  // Derive character_id from variant for default path lookups
  const charId = variant.character_id;

  // 1. Concept dir exists and has files
  const cDir = variant.concept_dir || conceptDir(rootPath, charId);
  const conceptExists = fs.existsSync(cDir);
  const conceptFiles = conceptExists ? fs.readdirSync(cDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg')) : [];
  checks.push({
    check: 'concept_exists',
    pass: conceptFiles.length > 0,
    detail: conceptExists
      ? `${conceptFiles.length} concept file(s) found`
      : `Concept dir missing: ${cDir}`,
  });

  // 2. Directional set has all 5 required dirs
  const dDir = variant.directional_dir || directionalDir(rootPath, charId);
  const dirExists = fs.existsSync(dDir);
  const presentDirs = dirExists
    ? DIRECTIONAL_DIRS.filter(d => fs.existsSync(path.join(dDir, d)))
    : [];
  const missingDirs = DIRECTIONAL_DIRS.filter(d => !presentDirs.includes(d));
  checks.push({
    check: 'directional_complete',
    pass: presentDirs.length === DIRECTIONAL_DIRS.length,
    detail: dirExists
      ? missingDirs.length === 0
        ? 'All 5 directional dirs present'
        : `Missing dirs: ${missingDirs.join(', ')}`
      : `Directional dir missing: ${dDir}`,
  });

  // 3. Sheet PNG exists
  const sDir = variant.sheet_path || sheetDir(rootPath, charId);
  let sheetFound = false;
  if (fs.existsSync(sDir)) {
    if (fs.statSync(sDir).isDirectory()) {
      const pngs = fs.readdirSync(sDir).filter(f => f.endsWith('.png'));
      sheetFound = pngs.length > 0;
    } else {
      // sheet_path points directly to a file
      sheetFound = true;
    }
  }
  checks.push({
    check: 'sheet_exists',
    pass: sheetFound,
    detail: sheetFound ? 'Sheet found' : `Sheet missing at: ${sDir}`,
  });

  // 4. Pack has 8 direction PNGs
  if (variant.pack_id) {
    const pDir = variant.pack_dir || packAssetDir(rootPath, variant.pack_id, variant.id);
    const packExists = fs.existsSync(pDir);
    const presentPngs = packExists
      ? PACK_DIRECTIONS.filter(f => fs.existsSync(path.join(pDir, f)))
      : [];
    const missingPngs = PACK_DIRECTIONS.filter(f => !presentPngs.includes(f));
    checks.push({
      check: 'pack_complete',
      pass: presentPngs.length === PACK_DIRECTIONS.length,
      detail: packExists
        ? missingPngs.length === 0
          ? 'All 8 direction PNGs present'
          : `Missing PNGs: ${missingPngs.join(', ')}`
        : `Pack dir missing: ${pDir}`,
    });
  } else {
    checks.push({
      check: 'pack_complete',
      pass: false,
      detail: 'No pack_id assigned to variant',
    });
  }

  return checks;
}
