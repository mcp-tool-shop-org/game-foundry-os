import type Database from 'better-sqlite3';
import type { FoundryBatchRow, BatchType, BatchStatus } from '@mcptoolshop/game-foundry-registry';
import crypto from 'node:crypto';

export interface CreateBatchInput {
  variant_id: string;
  batch_type: BatchType;
  direction?: string;
  candidate_count: number;
  source_model?: string;
  params_json?: string;
  output_dir?: string;
}

export function createBatch(db: Database.Database, input: CreateBatchInput): FoundryBatchRow {
  const id = `batch_${input.variant_id}_${input.batch_type}_${input.direction ?? 'all'}_${Date.now().toString(36)}`;

  db.prepare(`
    INSERT INTO foundry_batches (id, variant_id, batch_type, direction, candidate_count, source_model, params_json, output_dir)
    VALUES (@id, @variant_id, @batch_type, @direction, @candidate_count, @source_model, @params_json, @output_dir)
  `).run({
    id,
    variant_id: input.variant_id,
    batch_type: input.batch_type,
    direction: input.direction ?? null,
    candidate_count: input.candidate_count,
    source_model: input.source_model ?? null,
    params_json: input.params_json ?? null,
    output_dir: input.output_dir ?? null,
  });

  return db.prepare('SELECT * FROM foundry_batches WHERE id = ?').get(id) as FoundryBatchRow;
}

export function getBatch(db: Database.Database, id: string): FoundryBatchRow | undefined {
  return db.prepare('SELECT * FROM foundry_batches WHERE id = ?').get(id) as FoundryBatchRow | undefined;
}

export function listBatches(db: Database.Database, variantId: string, batchType?: BatchType): FoundryBatchRow[] {
  if (batchType) {
    return db.prepare('SELECT * FROM foundry_batches WHERE variant_id = ? AND batch_type = ? ORDER BY created_at')
      .all(variantId, batchType) as FoundryBatchRow[];
  }
  return db.prepare('SELECT * FROM foundry_batches WHERE variant_id = ? ORDER BY created_at')
    .all(variantId) as FoundryBatchRow[];
}

export function updateBatchStatus(db: Database.Database, id: string, status: BatchStatus): void {
  db.prepare('UPDATE foundry_batches SET status = ? WHERE id = ?').run(status, id);
}
