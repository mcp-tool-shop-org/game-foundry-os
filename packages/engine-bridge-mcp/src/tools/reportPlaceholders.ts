import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getProject, listCharacters, listVariantsForCharacter } from '@mcptoolshop/game-foundry-registry';
import { packAlbedoDir, countDirectionFiles } from '../utils/godot.js';

export interface PlaceholderReport {
  project_id: string;
  placeholders: Array<{
    character_id: string;
    variant_id: string;
    pack: string;
    reason: string;
  }>;
  placeholder_count: number;
  total_checked: number;
}

export function reportPlaceholders(db: Database.Database, projectId: string): PlaceholderReport {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const characters = listCharacters(db, { project_id: projectId });
  const placeholders: PlaceholderReport['placeholders'] = [];
  let totalChecked = 0;

  for (const char of characters) {
    const variants = listVariantsForCharacter(db, char.id);
    for (const variant of variants) {
      if (variant.variant_type === 'portrait') continue;
      totalChecked++;

      const packId = variant.pack_id;
      if (!packId) {
        placeholders.push({
          character_id: char.id,
          variant_id: variant.id,
          pack: 'none',
          reason: 'No pack assigned in registry',
        });
        continue;
      }

      const absDir = packAlbedoDir(project.root_path, packId, variant.id);
      const counts = countDirectionFiles(absDir);

      if (counts.pngs === 0) {
        placeholders.push({
          character_id: char.id,
          variant_id: variant.id,
          pack: packId,
          reason: 'No albedo PNGs found — will render as colored placeholder circle',
        });
      } else if (counts.pngs < 8) {
        placeholders.push({
          character_id: char.id,
          variant_id: variant.id,
          pack: packId,
          reason: `Only ${counts.pngs}/8 directions — missing facings will be placeholder circles`,
        });
      }
    }
  }

  return {
    project_id: projectId,
    placeholders,
    placeholder_count: placeholders.length,
    total_checked: totalChecked,
  };
}

export function registerReportPlaceholders(server: McpServer, db: Database.Database): void {
  server.tool(
    'report_placeholders',
    'Find characters that would render as colored placeholder circles due to missing sprite files',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = reportPlaceholders(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
