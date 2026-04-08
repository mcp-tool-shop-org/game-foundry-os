import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listPages } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';
import type { CanonPageRow } from '@mcptoolshop/game-foundry-registry';

const REQUIRED_FIELDS: Record<string, string[]> = {
  character: ['canon_id', 'kind', 'title'],
  encounter: ['canon_id', 'kind', 'title'],
  chapter: ['canon_id', 'kind', 'title'],
  project: ['canon_id', 'kind', 'title'],
  faction: ['canon_id', 'kind', 'title'],
  combat_doctrine: ['canon_id', 'kind', 'title'],
  art_doctrine: ['canon_id', 'kind', 'title'],
  proof_note: ['canon_id', 'kind', 'title'],
  handoff: ['canon_id', 'kind', 'title'],
};

export function registerCanonValidatePages(server: McpServer): void {
  server.tool(
    'canon_validate_pages',
    'Validate frontmatter of all canon pages for a project',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const pages = listPages(db, params.project_id);

      const results: Array<{
        canon_id: string;
        title: string;
        kind: string;
        valid: boolean;
        issues: string[];
      }> = [];

      for (const page of pages) {
        const issues = validatePage(page);
        results.push({
          canon_id: page.canon_id,
          title: page.title,
          kind: page.kind,
          valid: issues.length === 0,
          issues,
        });
      }

      const valid = results.filter((r) => r.valid).length;
      const invalid = results.filter((r) => !r.valid).length;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ total: results.length, valid, invalid, pages: results }),
        }],
      };
    },
  );
}

function validatePage(page: CanonPageRow): string[] {
  const issues: string[] = [];

  if (!page.frontmatter_json) {
    issues.push('Missing frontmatter_json');
    return issues;
  }

  let fm: Record<string, unknown>;
  try {
    fm = JSON.parse(page.frontmatter_json);
  } catch {
    issues.push('Invalid frontmatter_json (not valid JSON)');
    return issues;
  }

  const required = REQUIRED_FIELDS[page.kind] ?? REQUIRED_FIELDS.character;
  for (const field of required) {
    if (!fm[field]) {
      issues.push(`Missing required frontmatter field: ${field}`);
    }
  }

  return issues;
}
