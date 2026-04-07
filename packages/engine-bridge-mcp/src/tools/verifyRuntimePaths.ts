import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getProject, listCharacters, listVariantsForCharacter } from '@mcptoolshop/game-foundry-registry';
import { packAlbedoDir, countDirectionFiles, checkPortraits } from '../utils/godot.js';

export interface PathVerifyResult {
  project_id: string;
  characters: Array<{
    id: string;
    variant_id: string;
    pack_path: string | null;
    albedo_count: number;
    import_count: number;
    portrait_exists: boolean;
    all_ok: boolean;
  }>;
  pass: boolean;
  failures: string[];
}

export function verifyRuntimePaths(db: Database.Database, projectId: string): PathVerifyResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const characters = listCharacters(db, { project_id: projectId });
  const results: PathVerifyResult['characters'] = [];
  const failures: string[] = [];

  for (const char of characters) {
    const variants = listVariantsForCharacter(db, char.id);
    for (const variant of variants) {
      if (variant.variant_type === 'portrait') continue;

      const packPath = variant.pack_dir;
      let albedoCount = 0;
      let importCount = 0;

      if (packPath) {
        const absDir = packAlbedoDir(
          project.root_path,
          variant.pack_id || '',
          variant.id,
        );
        // Use the actual pack_dir from the variant if it differs
        const counts = countDirectionFiles(
          absDir.includes(variant.id) ? absDir : `${project.root_path}/${packPath}`,
        );
        albedoCount = counts.pngs;
        importCount = counts.imports;
      }

      const portraits = checkPortraits(project.root_path, char.display_name);
      const portraitExists = portraits.has_80 || portraits.has_28;

      const allOk = albedoCount >= 8 && importCount >= 8;
      if (!allOk) {
        const issues: string[] = [];
        if (albedoCount < 8) issues.push(`${albedoCount}/8 albedo PNGs`);
        if (importCount < 8) issues.push(`${importCount}/8 .import files`);
        failures.push(`${char.display_name} (${variant.id}): ${issues.join(', ')}`);
      }

      results.push({
        id: char.id,
        variant_id: variant.id,
        pack_path: packPath,
        albedo_count: albedoCount,
        import_count: importCount,
        portrait_exists: portraitExists,
        all_ok: allOk,
      });
    }
  }

  return {
    project_id: projectId,
    characters: results,
    pass: failures.length === 0,
    failures,
  };
}

export function registerVerifyRuntimePaths(server: McpServer, db: Database.Database): void {
  server.tool(
    'verify_runtime_paths',
    'Check that every character variant resolves to real files on disk with .import sidecars',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = verifyRuntimePaths(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
