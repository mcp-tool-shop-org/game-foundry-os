import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createProofRun, addAssertion } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';
import type { VariantRow } from '@mcptoolshop/game-foundry-registry';

export function registerProofRunPresentationSuite(server: McpServer): void {
  server.tool(
    'proof_run_presentation_suite',
    'Run presentation proof suite — checks portraits and placeholder absence',
    {
      project_id: z.string().describe('Project ID'),
      scope_type: z.enum(['variant', 'chapter']).describe('Scope type'),
      scope_id: z.string().describe('Scope ID'),
    },
    async (params) => {
      const db = getDb();
      const assertions: Array<{ key: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

      let variants: VariantRow[];
      if (params.scope_type === 'variant') {
        const v = db.prepare('SELECT * FROM variants WHERE id = ?').get(params.scope_id) as VariantRow | undefined;
        variants = v ? [v] : [];
      } else {
        variants = db.prepare(`
          SELECT v.* FROM variants v
          JOIN characters c ON v.character_id = c.id
          WHERE c.project_id = ? AND c.chapter_primary = ?
        `).all(params.project_id, params.scope_id) as VariantRow[];
      }

      for (const v of variants) {
        // Check portrait state
        if (v.portrait_state === 'complete') {
          assertions.push({ key: `${v.id}_portrait`, status: 'pass', message: `${v.id}: portraits complete` });
        } else if (v.portrait_state === 'attached') {
          assertions.push({ key: `${v.id}_portrait`, status: 'warn', message: `${v.id}: portraits attached but not complete` });
        } else {
          assertions.push({ key: `${v.id}_portrait`, status: 'warn', message: `${v.id}: portrait state is ${v.portrait_state}` });
        }

        // Check not a placeholder (pack_present + directions)
        if (v.pack_present === 1 && v.directions_present >= 8) {
          assertions.push({ key: `${v.id}_not_placeholder`, status: 'pass', message: `${v.id}: not a placeholder` });
        } else {
          assertions.push({ key: `${v.id}_not_placeholder`, status: 'fail', message: `${v.id}: placeholder (pack=${v.pack_present}, dirs=${v.directions_present})` });
        }
      }

      const failures = assertions.filter(a => a.status === 'fail');
      const warnings = assertions.filter(a => a.status === 'warn');
      const result = failures.length > 0 ? 'fail' as const : 'pass' as const;

      // Ensure suite exists
      const suiteId = `suite_presentation_${params.scope_type}`;
      db.prepare(`
        INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
        VALUES (?, ?, 'presentation', ?, 'Presentation Proof', 0)
      `).run(suiteId, params.project_id, params.scope_type);

      const run = createProofRun(db, {
        project_id: params.project_id,
        suite_id: suiteId,
        scope_type: params.scope_type,
        scope_id: params.scope_id,
        result,
        blocking_failures: failures.length,
        warning_count: warnings.length,
        summary: `Presentation suite: ${result}`,
        tool_name: 'proof_run_presentation_suite',
      });

      for (const a of assertions) {
        addAssertion(db, run.id, a.key, a.status, a.message);
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ run, passed: result === 'pass', assertions }) }] };
    },
  );
}
