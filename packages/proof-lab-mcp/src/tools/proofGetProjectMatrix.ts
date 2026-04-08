import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import type { ProofRunRow, FreezeCandidateRow, FreezeReceiptRow } from '@mcptoolshop/game-foundry-registry';

interface ScopeEntry {
  scope_type: string;
  scope_id: string;
  latest_proof_result: string | null;
  latest_proof_date: string | null;
  freeze_status: string;
  blocking_failures: number;
  warning_count: number;
}

export function registerProofGetProjectMatrix(server: McpServer): void {
  server.tool(
    'proof_get_project_matrix',
    'Aggregate proof/freeze state across all chapters, encounters, and variants for a project',
    {
      project_id: z.string().describe('Project ID'),
    },
    async (params) => {
      const db = getDb();
      const entries: ScopeEntry[] = [];

      // Variants
      const variants = db.prepare(`
        SELECT v.id FROM variants v
        JOIN characters c ON v.character_id = c.id
        WHERE c.project_id = ?
      `).all(params.project_id) as Array<{ id: string }>;

      for (const v of variants) {
        const run = db.prepare(`
          SELECT * FROM proof_runs WHERE scope_type = 'variant' AND scope_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(v.id) as ProofRunRow | undefined;

        const receipt = db.prepare(`
          SELECT * FROM freeze_receipts WHERE scope_type = 'variant' AND scope_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(v.id) as FreezeReceiptRow | undefined;

        entries.push({
          scope_type: 'variant',
          scope_id: v.id,
          latest_proof_result: run?.result ?? null,
          latest_proof_date: run?.created_at ?? null,
          freeze_status: receipt ? 'frozen' : 'unfrozen',
          blocking_failures: run?.blocking_failures ?? 0,
          warning_count: run?.warning_count ?? 0,
        });
      }

      // Encounters
      const encounters = db.prepare(`
        SELECT id FROM encounters WHERE project_id = ?
      `).all(params.project_id) as Array<{ id: string }>;

      for (const enc of encounters) {
        const run = db.prepare(`
          SELECT * FROM proof_runs WHERE scope_type = 'encounter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(enc.id) as ProofRunRow | undefined;

        const receipt = db.prepare(`
          SELECT * FROM freeze_receipts WHERE scope_type = 'encounter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(enc.id) as FreezeReceiptRow | undefined;

        entries.push({
          scope_type: 'encounter',
          scope_id: enc.id,
          latest_proof_result: run?.result ?? null,
          latest_proof_date: run?.created_at ?? null,
          freeze_status: receipt ? 'frozen' : 'unfrozen',
          blocking_failures: run?.blocking_failures ?? 0,
          warning_count: run?.warning_count ?? 0,
        });
      }

      // Chapters (unique)
      const chapters = db.prepare(`
        SELECT DISTINCT chapter FROM encounters WHERE project_id = ?
      `).all(params.project_id) as Array<{ chapter: string }>;

      for (const ch of chapters) {
        const run = db.prepare(`
          SELECT * FROM proof_runs WHERE scope_type = 'chapter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(ch.chapter) as ProofRunRow | undefined;

        const receipt = db.prepare(`
          SELECT * FROM freeze_receipts WHERE scope_type = 'chapter' AND scope_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(ch.chapter) as FreezeReceiptRow | undefined;

        entries.push({
          scope_type: 'chapter',
          scope_id: ch.chapter,
          latest_proof_result: run?.result ?? null,
          latest_proof_date: run?.created_at ?? null,
          freeze_status: receipt ? 'frozen' : 'unfrozen',
          blocking_failures: run?.blocking_failures ?? 0,
          warning_count: run?.warning_count ?? 0,
        });
      }

      const summary = {
        total: entries.length,
        proven: entries.filter(e => e.latest_proof_result === 'pass').length,
        failing: entries.filter(e => e.latest_proof_result === 'fail').length,
        unproven: entries.filter(e => e.latest_proof_result === null).length,
        frozen: entries.filter(e => e.freeze_status === 'frozen').length,
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ project_id: params.project_id, summary, entries }),
        }],
      };
    },
  );
}
