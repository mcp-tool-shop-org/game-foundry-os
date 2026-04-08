import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { upsertCharacter } from '@mcptoolshop/game-foundry-registry';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function registerStudioCreateCharacterStub(server: McpServer): void {
  server.tool(
    'studio_create_character_stub',
    'Create canon page + foundry scaffold for a new character',
    {
      project_id: z.string().describe('Project ID'),
      character_id: z.string().describe('Character identifier'),
      display_name: z.string().describe('Character display name'),
      role: z.enum(['party', 'enemy', 'boss', 'npc', 'miniboss']).default('enemy'),
      family: z.string().optional().describe('Character family grouping'),
      vault_path: z.string().optional().describe('Canon vault root (creates character page if provided)'),
    },
    async (params) => {
      const db = getDb();

      // Register character in foundry
      upsertCharacter(db, {
        id: params.character_id,
        project_id: params.project_id,
        display_name: params.display_name,
        role: params.role,
        family: params.family,
      });

      let canon_page_path: string | null = null;

      // Create canon page if vault path provided
      if (params.vault_path) {
        const canonId = `${params.project_id}-char-${params.character_id}`;
        const now = new Date().toISOString().slice(0, 10);
        const filePath = path.join(params.vault_path, '02_Characters', `${params.character_id}.md`);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        const content = [
          '---',
          `id: ${canonId}`,
          `kind: character`,
          `project: ${params.project_id}`,
          `title: "${params.display_name}"`,
          `role: ${params.role}`,
          `status: registered`,
          `updated: ${now}`,
          '---',
          '',
          `# ${params.display_name}`,
          '',
          '## Visual Design',
          '',
          '## Combat Role',
          '',
          '## Lore',
          '',
        ].join('\n');

        fs.writeFileSync(filePath, content, 'utf-8');
        canon_page_path = filePath;

        // Register canon page
        const pageId = crypto.randomUUID();
        db.prepare(`
          INSERT OR IGNORE INTO canon_pages (id, project_id, canon_id, kind, title, vault_path, status)
          VALUES (?, ?, ?, 'character', ?, ?, 'registered')
        `).run(pageId, params.project_id, canonId, params.display_name, filePath);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            created: true,
            character_id: params.character_id,
            role: params.role,
            canon_page_path,
          }, null, 2),
        }],
      };
    },
  );
}
