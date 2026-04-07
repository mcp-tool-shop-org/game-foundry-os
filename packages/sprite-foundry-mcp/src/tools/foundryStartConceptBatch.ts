import type Database from 'better-sqlite3';
import { z } from 'zod';
import { createBatch, transitionState, getNextStep } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerFoundryStartConceptBatch(server: McpServer, db: Database.Database): void {
  server.tool(
    'start_concept_batch',
    'Start a concept generation batch for a variant, transitions state to concept_batch_started',
    {
      variant_id: z.string().describe('Variant ID to start concept batch for'),
      candidate_count: z.number().int().min(1).describe('Number of concept candidates to generate'),
      source_model: z.string().optional().describe('AI model used for generation'),
      params_json: z.string().optional().describe('JSON string of generation parameters'),
      output_dir: z.string().optional().describe('Output directory for generated concepts'),
    },
    async (args) => {
      try {
        // Create the batch record
        const batch = createBatch(db, {
          variant_id: args.variant_id,
          batch_type: 'concept',
          candidate_count: args.candidate_count,
          source_model: args.source_model,
          params_json: args.params_json,
          output_dir: args.output_dir,
        });

        // Transition state
        const transition = transitionState(db, args.variant_id, 'concept_batch_started', {
          toolName: 'start_concept_batch',
          reason: `Concept batch started with ${args.candidate_count} candidates`,
          payload: { batch_id: batch.id },
        });

        // Get next step
        const nextStep = getNextStep(db, args.variant_id);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ batch, transition, next_step: nextStep }, null, 2) }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
