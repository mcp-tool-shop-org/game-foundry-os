import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getProject, listCharacters, listVariantsForCharacter } from '@mcptoolshop/game-foundry-registry';
import { packAlbedoDir, countDirectionFiles } from '../utils/godot.js';

export interface UnintegratedReport {
  project_id: string;
  unintegrated: Array<{
    character_id: string;
    variant_id: string;
    registry_status: string;
    disk_status: string;
    gap: string;
  }>;
  count: number;
}

export function reportUnintegrated(db: Database.Database, projectId: string): UnintegratedReport {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const characters = listCharacters(db, { project_id: projectId });
  const unintegrated: UnintegratedReport['unintegrated'] = [];

  for (const char of characters) {
    // Only check characters that the registry says are pack-complete
    if (char.pack_status !== 'complete') continue;

    const variants = listVariantsForCharacter(db, char.id);
    for (const variant of variants) {
      if (variant.variant_type === 'portrait') continue;

      const packId = variant.pack_id;
      if (!packId) {
        unintegrated.push({
          character_id: char.id,
          variant_id: variant.id,
          registry_status: 'pack_status=complete',
          disk_status: 'no pack_id assigned',
          gap: 'Registry says complete but variant has no pack assignment',
        });
        continue;
      }

      const absDir = packAlbedoDir(project.root_path, packId, variant.id);
      const counts = countDirectionFiles(absDir);

      const gaps: string[] = [];
      if (counts.pngs < 8) gaps.push(`${counts.pngs}/8 PNGs on disk`);
      if (counts.imports < 8) gaps.push(`${counts.imports}/8 .import files`);
      if (char.integration_status !== 'complete') gaps.push(`integration_status=${char.integration_status}`);

      if (gaps.length > 0) {
        unintegrated.push({
          character_id: char.id,
          variant_id: variant.id,
          registry_status: `pack_status=${char.pack_status}, integration=${char.integration_status}`,
          disk_status: `${counts.pngs} PNGs, ${counts.imports} imports`,
          gap: gaps.join('; '),
        });
      }
    }
  }

  return {
    project_id: projectId,
    unintegrated,
    count: unintegrated.length,
  };
}

export function registerReportUnintegrated(server: McpServer, db: Database.Database): void {
  server.tool(
    'report_unintegrated_assets',
    'Find characters where registry says complete but engine files are missing or incomplete',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = reportUnintegrated(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
