import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createChapter } from '@mcptoolshop/chapter-spine-core';
import { getDb } from '../server.js';

export function registerChapterCreate(server: McpServer): void {
  server.tool(
    'chapter_create',
    'Create/register a chapter for a project',
    {
      project_id: z.string().describe('Project ID'),
      chapter_id: z.string().describe('Chapter identifier'),
      display_name: z.string().describe('Human-readable chapter name'),
      sort_order: z.number().optional().describe('Sort order'),
      intent_summary: z.string().optional().describe('Design intent summary'),
      required_encounter_count: z.number().optional().describe('Required encounter count'),
      required_playtest_pass: z.boolean().optional().describe('Whether playtest pass is required'),
    },
    async (params) => {
      const db = getDb();
      const result = createChapter(db, params.project_id, params.chapter_id, params.display_name, {
        sort_order: params.sort_order,
        intent_summary: params.intent_summary,
        required_encounter_count: params.required_encounter_count,
        required_playtest_pass: params.required_playtest_pass,
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
