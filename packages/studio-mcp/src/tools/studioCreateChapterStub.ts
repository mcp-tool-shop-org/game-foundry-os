import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function registerStudioCreateChapterStub(server: McpServer): void {
  server.tool(
    'studio_create_chapter_stub',
    'Create canon page + registry scaffold for a new chapter',
    {
      project_id: z.string().describe('Project ID'),
      chapter_id: z.string().describe('Chapter identifier (e.g. ch2)'),
      title: z.string().describe('Chapter title'),
      vault_path: z.string().describe('Absolute path to canon vault root'),
    },
    async (params) => {
      const db = getDb();
      const canonId = `${params.project_id}-${params.chapter_id}`;
      const now = new Date().toISOString().slice(0, 10);

      // Create canon page file
      const filePath = path.join(params.vault_path, '01_Chapters', `${params.chapter_id}.md`);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = [
        '---',
        `id: ${canonId}`,
        `kind: chapter`,
        `project: ${params.project_id}`,
        `title: "${params.title}"`,
        `chapter: "${params.chapter_id}"`,
        `status: registered`,
        `updated: ${now}`,
        '---',
        '',
        `# ${params.title}`,
        '',
        '## Setting',
        '',
        '## Key Encounters',
        '',
        '## Characters Introduced',
        '',
      ].join('\n');

      fs.writeFileSync(filePath, content, 'utf-8');

      // Register canon page in DB
      const pageId = crypto.randomUUID();
      db.prepare(`
        INSERT OR IGNORE INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status, frontmatter_json)
        VALUES (?, ?, ?, 'chapter', ?, ?, 'registered', ?)
      `).run(pageId, params.project_id, canonId, params.title, filePath, JSON.stringify({ chapter: params.chapter_id }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            created: true,
            canon_id: canonId,
            file_path: filePath,
            chapter_id: params.chapter_id,
          }, null, 2),
        }],
      };
    },
  );
}
