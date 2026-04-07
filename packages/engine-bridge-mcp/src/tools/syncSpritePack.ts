import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import {
  getProject, getCharacter, getVariant,
  updateVariantPresence, setProductionState,
} from '@mcptoolshop/game-foundry-registry';
import { packAlbedoDir, directionalSourceDir, DIRECTIONAL_DIRS, DIR_MAP } from '../utils/godot.js';

export interface SyncResult {
  character_id: string;
  variant_id: string;
  files_copied: number;
  pack_path: string;
  receipt: string[];
}

export function syncSpritePack(
  db: Database.Database,
  projectId: string,
  characterId: string,
  variantId: string,
  packId: string,
): SyncResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const character = getCharacter(db, characterId);
  if (!character) throw new Error(`Character not found: ${characterId}`);

  const variant = getVariant(db, variantId);
  if (!variant) throw new Error(`Variant not found: ${variantId}`);

  const srcDir = directionalSourceDir(project.root_path, characterId);
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Directional source not found: ${srcDir}`);
  }

  const destDir = packAlbedoDir(project.root_path, packId, variantId);
  fs.mkdirSync(destDir, { recursive: true });

  const receipt: string[] = [];
  let filesCopied = 0;

  for (const foundryDir of DIRECTIONAL_DIRS) {
    const engineDirs = DIR_MAP[foundryDir];
    if (!engineDirs) continue;

    // Find frame 01 in the foundry directory
    const foundryPath = path.join(srcDir, foundryDir);
    if (!fs.existsSync(foundryPath)) {
      receipt.push(`SKIP: ${foundryDir}/ not found`);
      continue;
    }

    const frames = fs.readdirSync(foundryPath)
      .filter(f => f.endsWith('.png') && !f.endsWith('.import'))
      .sort();

    if (frames.length === 0) {
      receipt.push(`SKIP: ${foundryDir}/ has no PNGs`);
      continue;
    }

    const srcFile = path.join(foundryPath, frames[0]); // frame 01

    for (const engineDir of engineDirs) {
      const destFile = path.join(destDir, `${engineDir}.png`);
      fs.copyFileSync(srcFile, destFile);
      receipt.push(`COPY: ${foundryDir}/${frames[0]} → ${engineDir}.png`);
      filesCopied++;
    }
  }

  // Update registry
  updateVariantPresence(db, variantId, {
    pack_present: filesCopied >= 8 ? 1 : 0,
    directions_present: filesCopied,
  });

  if (filesCopied >= 8) {
    try { setProductionState(db, characterId, 'integration_status', 'complete'); } catch { /* */ }
  }

  return {
    character_id: characterId,
    variant_id: variantId,
    files_copied: filesCopied,
    pack_path: destDir,
    receipt,
  };
}

export function registerSyncSpritePack(server: McpServer, db: Database.Database): void {
  server.tool(
    'sync_sprite_pack',
    'Copy directional sprites into engine pack structure (5-dir → 8-dir mapping)',
    {
      project_id: z.string(),
      character_id: z.string(),
      variant_id: z.string(),
      pack_id: z.string(),
    },
    async ({ project_id, character_id, variant_id, pack_id }) => {
      try {
        const result = syncSpritePack(db, project_id, character_id, variant_id, pack_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
