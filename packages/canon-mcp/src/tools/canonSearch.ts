import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchPages } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonSearch(server: McpServer): void {
  server.tool(
    'canon_search',
    'Search canon pages by text query on title, vault_path, and frontmatter',
    {
      project_id: z.string().describe('Project ID'),
      query: z.string().describe('Search text'),
      kind: z.string().optional().describe('Filter by page kind'),
      status: z.string().optional().describe('Filter by page status'),
    },
    async (params) => {
      const db = getDb();
      const results = searchPages(db, params.project_id, params.query, {
        kind: params.kind,
        status: params.status,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ count: results.length, pages: results }) }] };
    },
  );
}
