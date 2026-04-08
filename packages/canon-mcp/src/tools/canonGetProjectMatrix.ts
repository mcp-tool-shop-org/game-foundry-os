import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listPages, getLinks } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGetProjectMatrix(server: McpServer): void {
  server.tool(
    'canon_get_project_matrix',
    'Aggregate canon coverage across all chapters, characters, and encounters for a project',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const pages = listPages(db, params.project_id);

      // Count by kind
      const byKind: Record<string, number> = {};
      for (const page of pages) {
        byKind[page.kind] = (byKind[page.kind] ?? 0) + 1;
      }

      // Count by status
      const byStatus: Record<string, number> = {};
      for (const page of pages) {
        byStatus[page.status] = (byStatus[page.status] ?? 0) + 1;
      }

      // Coverage: how many runtime objects have canon pages
      const characterCount = (db.prepare(
        'SELECT COUNT(*) as count FROM characters WHERE project_id = ?',
      ).get(params.project_id) as { count: number }).count;

      const charactersCovered = (db.prepare(
        "SELECT COUNT(DISTINCT target_id) as count FROM canon_links WHERE project_id = ? AND target_type = 'character'",
      ).get(params.project_id) as { count: number }).count;

      const encounterCount = (db.prepare(
        'SELECT COUNT(*) as count FROM encounters WHERE project_id = ?',
      ).get(params.project_id) as { count: number }).count;

      const encountersCovered = (db.prepare(
        "SELECT COUNT(DISTINCT target_id) as count FROM canon_links WHERE project_id = ? AND target_type = 'encounter'",
      ).get(params.project_id) as { count: number }).count;

      // Linked vs unlinked pages
      let linkedCount = 0;
      for (const page of pages) {
        const links = getLinks(db, page.canon_id);
        if (links.length > 0) linkedCount++;
      }

      // Drift summary
      const driftReports = db.prepare(
        "SELECT result, COUNT(*) as count FROM canon_drift_reports WHERE project_id = ? GROUP BY result",
      ).all(params.project_id) as Array<{ result: string; count: number }>;

      const driftSummary: Record<string, number> = {};
      for (const r of driftReports) {
        driftSummary[r.result] = r.count;
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total_pages: pages.length,
            by_kind: byKind,
            by_status: byStatus,
            linked_pages: linkedCount,
            unlinked_pages: pages.length - linkedCount,
            coverage: {
              characters: { total: characterCount, covered: charactersCovered },
              encounters: { total: encounterCount, covered: encountersCovered },
            },
            drift_summary: driftSummary,
          }),
        }],
      };
    },
  );
}
