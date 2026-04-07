import type Database from 'better-sqlite3';
import { z } from 'zod';
import { createBatch, transitionState, getNextStep } from '@mcptoolshop/sprite-foundry-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DEFAULT_DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

export function registerFoundryStartDirectionalBatch(server: McpServer, db: Database.Database): void {
  server.tool(
    'start_directional_batch',
    'Start directional generation batches (one per direction) for a variant',
    {
      variant_id: z.string().describe('Variant ID'),
      directions: z.array(z.string()).optional().describe('Directions to generate (default: front, front_34, side, back_34, back)'),
      candidate_count_per_direction: z.number().int().min(1).describe('Number of candidates per direction'),
      source_model: z.string().optional().describe('AI model used for generation'),
      params_json: z.string().optional().describe('JSON string of generation parameters'),
      output_dir: z.string().optional().describe('Base output directory for generated directionals'),
    },
    async (args) => {
      try {
        const directions = args.directions ?? DEFAULT_DIRECTIONS;

        // Create one batch per direction
        const batches = directions.map(dir =>
          createBatch(db, {
            variant_id: args.variant_id,
            batch_type: 'directional',
            direction: dir,
            candidate_count: args.candidate_count_per_direction,
            source_model: args.source_model,
            params_json: args.params_json,
            output_dir: args.output_dir ? `${args.output_dir}/${dir}` : undefined,
          }),
        );

        // Transition state
        const transition = transitionState(db, args.variant_id, 'directional_batch_started', {
          toolName: 'start_directional_batch',
          reason: `Directional batches started for ${directions.length} directions`,
          payload: { directions, batch_ids: batches.map(b => b.id) },
        });

        const nextStep = getNextStep(db, args.variant_id);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ batches, transition, next_step: nextStep }, null, 2),
          }],
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
