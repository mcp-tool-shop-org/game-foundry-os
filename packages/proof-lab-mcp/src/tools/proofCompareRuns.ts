import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getProofRun, getAssertions } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofCompareRuns(server: McpServer): void {
  server.tool(
    'proof_compare_runs',
    'Compare two proof runs — diffs their assertions',
    {
      run_id_a: z.string().describe('First proof run ID'),
      run_id_b: z.string().describe('Second proof run ID'),
    },
    async (params) => {
      const db = getDb();
      const runA = getProofRun(db, params.run_id_a);
      const runB = getProofRun(db, params.run_id_b);

      if (!runA || !runB) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'One or both runs not found' }) }] };
      }

      const assertionsA = getAssertions(db, params.run_id_a);
      const assertionsB = getAssertions(db, params.run_id_b);

      const mapA = new Map(assertionsA.map(a => [a.assertion_key, a]));
      const mapB = new Map(assertionsB.map(a => [a.assertion_key, a]));
      const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);

      const diffs: Array<{
        key: string;
        status_a: string | null;
        status_b: string | null;
        changed: boolean;
        message_a: string | null;
        message_b: string | null;
      }> = [];

      for (const key of allKeys) {
        const a = mapA.get(key);
        const b = mapB.get(key);
        diffs.push({
          key,
          status_a: a?.status ?? null,
          status_b: b?.status ?? null,
          changed: (a?.status ?? null) !== (b?.status ?? null),
          message_a: a?.message ?? null,
          message_b: b?.message ?? null,
        });
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            run_a: { id: runA.id, result: runA.result, created_at: runA.created_at },
            run_b: { id: runB.id, result: runB.result, created_at: runB.created_at },
            total_assertions: allKeys.size,
            changed: diffs.filter(d => d.changed).length,
            diffs,
          }),
        }],
      };
    },
  );
}
