import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  getProject,
  upsertCharacter,
  upsertVariant,
  updateVariantPresence,
} from '@mcptoolshop/game-foundry-registry';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { spritesRoot, DIRECTIONAL_DIRS, PACK_DIRECTIONS } from '../utils/paths.js';

interface ScanResult {
  scanned: number;
  new_characters: number;
  updated: number;
  errors: string[];
}

function safeDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
}

export function registerScanAssets(server: McpServer, db: Database.Database): void {
  server.tool(
    'scan_assets',
    'Walk the project sprite filesystem, discover characters and variants, update the registry',
    {
      project_id: z.string().describe('Project ID to scan'),
    },
    async ({ project_id }) => {
      const project = getProject(db, project_id);
      if (!project) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Project not found: ${project_id}` }) }],
          isError: true,
        };
      }

      const result = scanProjectAssets(db, project_id, project.root_path);

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}

export function scanProjectAssets(
  db: Database.Database,
  projectId: string,
  rootPath: string,
): ScanResult {
  const result: ScanResult = { scanned: 0, new_characters: 0, updated: 0, errors: [] };
  const seen = new Set<string>();
  const root = spritesRoot(rootPath);

  // 1. Scan concepts
  const conceptsDir = path.join(root, 'concepts');
  for (const id of safeDirs(conceptsDir)) {
    seen.add(id);
    try {
      ensureCharacter(db, projectId, id);
      result.scanned++;
    } catch (err) {
      result.errors.push(`concept/${id}: ${(err as Error).message}`);
    }
  }

  // 2. Scan directionals
  const directionalRoot = path.join(root, 'directional');
  for (const id of safeDirs(directionalRoot)) {
    seen.add(id);
    try {
      ensureCharacter(db, projectId, id);
      const dirPath = path.join(directionalRoot, id);
      const presentCount = DIRECTIONAL_DIRS.filter(d =>
        fs.existsSync(path.join(dirPath, d)),
      ).length;

      ensureVariant(db, id);
      updateVariantPresence(db, id + '_base', { directions_present: presentCount });
      result.scanned++;
    } catch (err) {
      result.errors.push(`directional/${id}: ${(err as Error).message}`);
    }
  }

  // 3. Scan sheets
  const sheetsDir = path.join(root, 'sheets');
  for (const id of safeDirs(sheetsDir)) {
    seen.add(id);
    try {
      ensureCharacter(db, projectId, id);
      const sheetPath = path.join(sheetsDir, id);
      const hasPng = fs.readdirSync(sheetPath).some(f => f.endsWith('.png'));

      ensureVariant(db, id);
      updateVariantPresence(db, id + '_base', { sheet_present: hasPng ? 1 : 0 });
      result.scanned++;
    } catch (err) {
      result.errors.push(`sheets/${id}: ${(err as Error).message}`);
    }
  }

  // 4. Scan packs: {root}/assets/sprites/{pack_id}/assets/{variant_id}/albedo/
  for (const packDir of safeDirs(root)) {
    // Skip known non-pack directories
    if (['concepts', 'directional', 'sheets'].includes(packDir)) continue;

    const assetsDir = path.join(root, packDir, 'assets');
    if (!fs.existsSync(assetsDir)) continue;

    for (const variantId of safeDirs(assetsDir)) {
      const albedoDir = path.join(assetsDir, variantId, 'albedo');
      if (!fs.existsSync(albedoDir)) continue;

      try {
        // Extract character_id from variant_id (strip _base, _phase2, etc.)
        const charId = variantId.replace(/_(base|phase2|portrait|alt)$/, '');
        seen.add(charId);
        ensureCharacter(db, projectId, charId);

        const variantType = variantId.endsWith('_phase2') ? 'phase2'
          : variantId.endsWith('_portrait') ? 'portrait'
          : variantId.endsWith('_alt') ? 'alt'
          : 'base';

        const resolvedVariantId = variantType === 'base' && !variantId.endsWith('_base')
          ? variantId + '_base'
          : variantId;

        upsertVariant(db, {
          id: resolvedVariantId,
          character_id: charId,
          variant_type: variantType,
          pack_id: packDir,
          pack_dir: albedoDir,
        });

        const presentPngs = PACK_DIRECTIONS.filter(f =>
          fs.existsSync(path.join(albedoDir, f)),
        ).length;

        updateVariantPresence(db, resolvedVariantId, { pack_present: presentPngs === PACK_DIRECTIONS.length ? 1 : 0 });
        result.scanned++;
      } catch (err) {
        result.errors.push(`pack/${packDir}/${variantId}: ${(err as Error).message}`);
      }
    }
  }

  // Count new vs updated
  const allChars = db.prepare('SELECT id FROM characters WHERE project_id = ?').all(projectId) as { id: string }[];
  result.new_characters = allChars.filter(c => seen.has(c.id)).length;
  result.updated = result.scanned;

  return result;
}

function ensureCharacter(db: Database.Database, projectId: string, id: string): void {
  const existing = db.prepare('SELECT id FROM characters WHERE id = ?').get(id);
  if (!existing) {
    upsertCharacter(db, {
      id,
      project_id: projectId,
      display_name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    });
  }
}

function ensureVariant(db: Database.Database, characterId: string): void {
  const variantId = characterId + '_base';
  const existing = db.prepare('SELECT id FROM variants WHERE id = ?').get(variantId);
  if (!existing) {
    upsertVariant(db, {
      id: variantId,
      character_id: characterId,
      variant_type: 'base',
    });
  }
}
