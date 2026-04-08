import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { generateHandoff } from '@mcptoolshop/canon-core';
import { getDb } from '../server.js';

export function registerCanonGenerateHandoff(server: McpServer): void {
  server.tool(
    'canon_generate_handoff',
    'Generate a structured handoff artifact from canon + production + proof + freeze data',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type: character, encounter, or chapter'),
      scope_id: z.string().describe('Scope ID'),
      artifact_type: z.string().describe('Handoff artifact type (chapter_handoff, freeze_packet, production_brief, sprint_handoff)'),
      output_path: z.string().optional().describe('Optional file path to write handoff JSON'),
    },
    async (params) => {
      const db = getDb();
      const handoff = generateHandoff(
        db,
        params.project_id,
        params.scope_type,
        params.scope_id,
        params.artifact_type,
        params.output_path,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(handoff) }] };
    },
  );
}
