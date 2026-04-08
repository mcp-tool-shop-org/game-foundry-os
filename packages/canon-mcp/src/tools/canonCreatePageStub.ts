import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import fs from 'node:fs';
import path from 'node:path';

export function registerCanonCreatePageStub(server: McpServer): void {
  server.tool(
    'canon_create_page_stub',
    'Create a markdown file with valid frontmatter template for a new canon page',
    {
      vault_root: z.string().describe('Absolute path to vault root'),
      relative_path: z.string().describe('Relative path within vault (e.g., characters/skeleton_warrior.md)'),
      canon_id: z.string().describe('Unique canon identifier'),
      kind: z.string().describe('Page kind (character, encounter, chapter, faction, etc.)'),
      title: z.string().describe('Page title'),
      extra_frontmatter: z.record(z.unknown()).optional().describe('Additional frontmatter key-value pairs'),
    },
    async (params) => {
      const fullPath = path.join(params.vault_root, params.relative_path);
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fm: Record<string, unknown> = {
        canon_id: params.canon_id,
        kind: params.kind,
        title: params.title,
        ...params.extra_frontmatter,
      };

      const lines = ['---'];
      for (const [key, value] of Object.entries(fm)) {
        if (Array.isArray(value)) {
          lines.push(`${key}:`);
          for (const item of value) {
            lines.push(`  - ${item}`);
          }
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
      lines.push('---');
      lines.push('');
      lines.push(`# ${params.title}`);
      lines.push('');
      lines.push('<!-- Add canon content here -->');
      lines.push('');

      fs.writeFileSync(fullPath, lines.join('\n'), 'utf-8');

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ created: true, path: fullPath, canon_id: params.canon_id }),
        }],
      };
    },
  );
}
