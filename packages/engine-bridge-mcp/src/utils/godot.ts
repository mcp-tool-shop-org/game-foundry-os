import fs from 'node:fs';
import path from 'node:path';

/** The 8 directions Godot's SpriteLoader expects */
export const DIRECTIONS = [
  'front', 'front_left', 'left', 'back_left',
  'back', 'back_right', 'right', 'front_right',
] as const;

/** The 5 directional subdirs from the foundry pipeline */
export const DIRECTIONAL_DIRS = ['front', 'front_34', 'side', 'back_34', 'back'] as const;

/** Maps foundry directional dirs → engine direction names */
export const DIR_MAP: Record<string, string[]> = {
  'front': ['front'],
  'front_34': ['front_right', 'front_left'],
  'side': ['right', 'left'],
  'back_34': ['back_right', 'back_left'],
  'back': ['back'],
};

/** Portrait sizes used by CombatHUD */
export const PORTRAIT_SIZES = ['80x80', '28x28'] as const;

/** Portrait base directory (relative to project root) */
export const PORTRAIT_DIR = 'assets/portraits/gate_test';

// ─── Path resolution ────────────────────────────────────────

/** Resolve the pack albedo directory for a variant */
export function packAlbedoDir(projectRoot: string, packId: string, variantId: string): string {
  return path.join(projectRoot, 'assets', 'sprites', packId, 'assets', variantId, 'albedo');
}

/** Resolve the directional source directory for a character */
export function directionalSourceDir(projectRoot: string, characterId: string): string {
  return path.join(projectRoot, 'assets', 'sprites', 'directional', characterId);
}

/** Resolve portrait path */
export function portraitPath(projectRoot: string, characterName: string, size: string): string {
  return path.join(projectRoot, PORTRAIT_DIR, `${characterName.toLowerCase()}_${size}.png`);
}

// ─── Filesystem checks ─────────────────────────────────────

export interface DirectionCheck {
  direction: string;
  png_exists: boolean;
  import_exists: boolean;
}

/** Check all 8 directions in a pack albedo directory */
export function checkPackDirections(albedoDir: string): DirectionCheck[] {
  return DIRECTIONS.map(dir => {
    const pngPath = path.join(albedoDir, `${dir}.png`);
    const importPath = path.join(albedoDir, `${dir}.png.import`);
    return {
      direction: dir,
      png_exists: fs.existsSync(pngPath),
      import_exists: fs.existsSync(importPath),
    };
  });
}

/** Count how many PNGs and .import files exist in a pack dir */
export function countDirectionFiles(albedoDir: string): { pngs: number; imports: number } {
  if (!fs.existsSync(albedoDir)) return { pngs: 0, imports: 0 };
  const checks = checkPackDirections(albedoDir);
  return {
    pngs: checks.filter(c => c.png_exists).length,
    imports: checks.filter(c => c.import_exists).length,
  };
}

/** Check if a character has portraits at the expected paths */
export function checkPortraits(projectRoot: string, characterName: string): {
  has_80: boolean;
  has_28: boolean;
} {
  return {
    has_80: fs.existsSync(portraitPath(projectRoot, characterName, '80x80')),
    has_28: fs.existsSync(portraitPath(projectRoot, characterName, '28x28')),
  };
}

/** Check directional source completeness (5 subdirs with at least 1 PNG each) */
export function checkDirectionalSource(projectRoot: string, characterId: string): {
  dirs_present: number;
  total_frames: number;
  complete: boolean;
} {
  const srcDir = directionalSourceDir(projectRoot, characterId);
  if (!fs.existsSync(srcDir)) return { dirs_present: 0, total_frames: 0, complete: false };

  let dirsPresent = 0;
  let totalFrames = 0;

  for (const dir of DIRECTIONAL_DIRS) {
    const dirPath = path.join(srcDir, dir);
    if (fs.existsSync(dirPath)) {
      const pngs = fs.readdirSync(dirPath).filter(f => f.endsWith('.png') && !f.endsWith('.import'));
      if (pngs.length > 0) {
        dirsPresent++;
        totalFrames += pngs.length;
      }
    }
  }

  return { dirs_present: dirsPresent, total_frames: totalFrames, complete: dirsPresent >= 5 };
}
