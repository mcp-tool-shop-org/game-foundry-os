import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { generateFreezeReport } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';
import fs from 'node:fs';
import path from 'node:path';

export function registerProofGenerateFreezeReport(server: McpServer): void {
  server.tool(
    'proof_generate_freeze_report',
    'Generate a structured freeze report for a scope, optionally writing JSON to disk',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.string().describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
      output_path: z.string().optional().describe('Optional path to write report JSON'),
    },
    async (params) => {
      const db = getDb();
      const report = generateFreezeReport(db, params.project_id, params.scope_type, params.scope_id);

      if (params.output_path) {
        const dir = path.dirname(params.output_path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(params.output_path, JSON.stringify(report, null, 2));
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(report) }] };
    },
  );
}
