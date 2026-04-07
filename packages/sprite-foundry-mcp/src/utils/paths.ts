import path from 'node:path';

/**
 * Sprite pipeline path conventions.
 * All paths are relative to the project root_path.
 */

/** Concept art directory for a character/variant */
export function conceptDir(rootPath: string, id: string): string {
  return path.join(rootPath, 'assets', 'sprites', 'concepts', id);
}

/** Directional sprite set directory for a character/variant */
export function directionalDir(rootPath: string, id: string): string {
  return path.join(rootPath, 'assets', 'sprites', 'directional', id);
}

/** Expected sub-directions inside a directional set */
export const DIRECTIONAL_DIRS = ['front', 'front_34', 'side', 'back_34', 'back'] as const;

/** Sheet sprite path for a character/variant */
export function sheetDir(rootPath: string, id: string): string {
  return path.join(rootPath, 'assets', 'sprites', 'sheets', id);
}

/** Pack asset directory for a variant inside a pack */
export function packAssetDir(rootPath: string, packId: string, variantId: string): string {
  return path.join(rootPath, 'assets', 'sprites', packId, 'assets', variantId, 'albedo');
}

/** Expected 8-direction PNG filenames in a pack */
export const PACK_DIRECTIONS = [
  'front.png', 'front_34.png', 'side.png', 'back_34.png',
  'back.png', 'side_flip.png', 'front_34_flip.png', 'back_34_flip.png',
] as const;

/** Top-level sprite directories to scan */
export function spritesRoot(rootPath: string): string {
  return path.join(rootPath, 'assets', 'sprites');
}
