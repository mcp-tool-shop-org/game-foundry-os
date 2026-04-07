import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
} from '@mcptoolshop/game-foundry-registry';
import {
  PRODUCTION_STATES,
  canTransition,
  transitionState,
  getStateEvents,
  getProductionState,
  createBatch,
  getBatch,
  listBatches,
  updateBatchStatus,
  lockPick,
  getLockedPicks,
  hasAllDirectionalLocks,
  registerArtifact,
  getArtifacts,
  getCanonicalArtifact,
  computeFileHash,
  getNextStep,
  getVariantTimeline,
  getCharacterTimeline,
} from '@mcptoolshop/sprite-foundry-core';

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
  upsertCharacter(db, { id: 'char1', project_id: 'test', display_name: 'Char 1' });
  upsertVariant(db, { id: 'var1', character_id: 'char1', variant_type: 'base' });
});

// ─── State Machine ────────────────────────────────────────

describe('state machine', () => {
  it('allows valid forward transition draft -> concept_batch_started', () => {
    const result = transitionState(db, 'var1', 'concept_batch_started');
    expect(result.from_state).toBe('draft');
    expect(result.to_state).toBe('concept_batch_started');
    expect(result.variant_id).toBe('var1');
    expect(result.event_id).toBeGreaterThan(0);
  });

  it('rejects invalid transition draft -> sheet_assembled', () => {
    expect(() => transitionState(db, 'var1', 'sheet_assembled'))
      .toThrow(/Invalid transition.*draft.*sheet_assembled/);
  });

  it('writes immutable state_events row on transition', () => {
    transitionState(db, 'var1', 'concept_batch_started', {
      reason: 'test reason',
      toolName: 'test_tool',
    });
    const events = getStateEvents(db, 'variant', 'var1');
    expect(events).toHaveLength(1);
    expect(events[0].from_state).toBe('draft');
    expect(events[0].to_state).toBe('concept_batch_started');
    expect(events[0].reason).toBe('test reason');
    expect(events[0].tool_name).toBe('test_tool');
    expect(events[0].project_id).toBe('test');
  });

  it('updates variant production_state on transition', () => {
    transitionState(db, 'var1', 'concept_batch_started');
    const state = getProductionState(db, 'var1');
    expect(state).toBe('concept_batch_started');
  });

  it('throws for nonexistent variant', () => {
    expect(() => transitionState(db, 'nonexistent', 'concept_batch_started'))
      .toThrow(/Variant not found: nonexistent/);
  });

  it('canTransition returns false for backward transitions', () => {
    transitionState(db, 'var1', 'concept_batch_started');
    expect(canTransition('concept_batch_started', 'draft')).toBe(false);
  });

  it('canTransition returns true for valid forward transition', () => {
    expect(canTransition('draft', 'concept_batch_started')).toBe(true);
    expect(canTransition('concept_locked', 'directional_batch_started')).toBe(true);
  });

  it('canTransition returns false for skip transitions', () => {
    expect(canTransition('draft', 'directional_locked')).toBe(false);
    expect(canTransition('concept_batch_started', 'frozen')).toBe(false);
  });

  it('chains multiple transitions through the full lifecycle', () => {
    const steps: Array<[string, string]> = [
      ['draft', 'concept_batch_started'],
      ['concept_batch_started', 'concept_candidates_recorded'],
      ['concept_candidates_recorded', 'concept_locked'],
      ['concept_locked', 'directional_batch_started'],
      ['directional_batch_started', 'directional_locked'],
      ['directional_locked', 'sheet_assembled'],
      ['sheet_assembled', 'pack_sliced'],
      ['pack_sliced', 'engine_synced'],
      ['engine_synced', 'proved'],
      ['proved', 'frozen'],
    ];
    for (const [from, to] of steps) {
      const result = transitionState(db, 'var1', to as any);
      expect(result.from_state).toBe(from);
      expect(result.to_state).toBe(to);
    }
    expect(getProductionState(db, 'var1')).toBe('frozen');
    const events = getStateEvents(db, 'variant', 'var1');
    expect(events).toHaveLength(10);
  });
});

// ─── Batches ──────────────────────────────────────────────

describe('batches', () => {
  it('creates a concept batch with generated id', () => {
    const batch = createBatch(db, {
      variant_id: 'var1',
      batch_type: 'concept',
      candidate_count: 4,
      source_model: 'sdxl',
    });
    expect(batch.id).toContain('batch_var1_concept');
    expect(batch.variant_id).toBe('var1');
    expect(batch.batch_type).toBe('concept');
    expect(batch.candidate_count).toBe(4);
    expect(batch.source_model).toBe('sdxl');
    expect(batch.status).toBe('open');
  });

  it('lists batches filtered by type', () => {
    // Use separate variants to avoid ID collision from same Date.now() timestamp
    upsertVariant(db, { id: 'var_b1', character_id: 'char1', variant_type: 'base' });
    upsertVariant(db, { id: 'var_b2', character_id: 'char1', variant_type: 'alt' });
    upsertVariant(db, { id: 'var_b3', character_id: 'char1', variant_type: 'phase2' });
    createBatch(db, { variant_id: 'var_b1', batch_type: 'concept', candidate_count: 4 });
    createBatch(db, { variant_id: 'var_b2', batch_type: 'directional', direction: 'front', candidate_count: 3 });
    createBatch(db, { variant_id: 'var_b3', batch_type: 'concept', candidate_count: 2 });

    const conceptBatches1 = listBatches(db, 'var_b1', 'concept');
    expect(conceptBatches1).toHaveLength(1);

    const conceptBatches3 = listBatches(db, 'var_b3', 'concept');
    expect(conceptBatches3).toHaveLength(1);

    const dirBatches = listBatches(db, 'var_b2', 'directional');
    expect(dirBatches).toHaveLength(1);

    // All batches for var_b1
    const allBatches = listBatches(db, 'var_b1');
    expect(allBatches).toHaveLength(1);
  });

  it('updates batch status', () => {
    const batch = createBatch(db, { variant_id: 'var1', batch_type: 'concept', candidate_count: 4 });
    expect(batch.status).toBe('open');

    updateBatchStatus(db, batch.id, 'recorded');
    const updated = getBatch(db, batch.id);
    expect(updated!.status).toBe('recorded');
  });

  it('getBatch returns undefined for nonexistent id', () => {
    expect(getBatch(db, 'nonexistent')).toBeUndefined();
  });
});

// ─── Picks ────────────────────────────────────────────────

describe('picks', () => {
  it('locks a concept pick', () => {
    const pick = lockPick(db, {
      variant_id: 'var1',
      pick_type: 'concept',
      candidate_name: 'concept_02.png',
      candidate_index: 2,
    });
    expect(pick.variant_id).toBe('var1');
    expect(pick.pick_type).toBe('concept');
    expect(pick.candidate_name).toBe('concept_02.png');
    expect(pick.candidate_index).toBe(2);
    expect(pick.direction).toBeNull();
  });

  it('locks directional picks', () => {
    const directions = ['front', 'front_34', 'side', 'back_34', 'back'];
    for (const dir of directions) {
      const pick = lockPick(db, {
        variant_id: 'var1',
        pick_type: 'directional',
        direction: dir,
        candidate_name: `${dir}_01.png`,
        candidate_index: 1,
      });
      expect(pick.direction).toBe(dir);
      expect(pick.pick_type).toBe('directional');
    }

    const picks = getLockedPicks(db, 'var1', 'directional');
    expect(picks).toHaveLength(5);
  });

  it('hasAllDirectionalLocks returns false with 3 of 5', () => {
    const partial = ['front', 'side', 'back'];
    for (const dir of partial) {
      lockPick(db, {
        variant_id: 'var1',
        pick_type: 'directional',
        direction: dir,
        candidate_name: `${dir}_01.png`,
      });
    }
    expect(hasAllDirectionalLocks(db, 'var1')).toBe(false);
  });

  it('hasAllDirectionalLocks returns true with all 5', () => {
    const all = ['front', 'front_34', 'side', 'back_34', 'back'];
    for (const dir of all) {
      lockPick(db, {
        variant_id: 'var1',
        pick_type: 'directional',
        direction: dir,
        candidate_name: `${dir}_01.png`,
      });
    }
    expect(hasAllDirectionalLocks(db, 'var1')).toBe(true);
  });

  it('upserts existing pick for same variant+type+direction', () => {
    lockPick(db, {
      variant_id: 'var1',
      pick_type: 'directional',
      direction: 'front',
      candidate_name: 'front_01.png',
      candidate_index: 1,
    });

    // Lock again with different candidate — should upsert
    const updated = lockPick(db, {
      variant_id: 'var1',
      pick_type: 'directional',
      direction: 'front',
      candidate_name: 'front_03.png',
      candidate_index: 3,
    });

    expect(updated.candidate_name).toBe('front_03.png');
    expect(updated.candidate_index).toBe(3);

    // Should still be only 1 pick for front
    const picks = getLockedPicks(db, 'var1', 'directional');
    const frontPicks = picks.filter(p => p.direction === 'front');
    expect(frontPicks).toHaveLength(1);
  });
});

// ─── Artifacts ────────────────────────────────────────────

describe('artifacts', () => {
  it('registers an artifact with content hash', () => {
    const artifact = registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var1',
      artifact_type: 'concept_candidate',
      path: '/tmp/test/concept_01.png',
      content_hash: 'abc123',
      width: 512,
      height: 512,
    });
    expect(artifact.id).toContain('art_var1_concept_candidate');
    expect(artifact.content_hash).toBe('abc123');
    expect(artifact.width).toBe(512);
    expect(artifact.height).toBe(512);
    expect(artifact.is_canonical).toBe(1);
  });

  it('getCanonicalArtifact returns latest canonical', () => {
    // Use separate variants to avoid ID collision from same millisecond
    upsertVariant(db, { id: 'var_art1', character_id: 'char1', variant_type: 'base' });
    upsertVariant(db, { id: 'var_art2', character_id: 'char1', variant_type: 'alt' });

    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var_art1',
      artifact_type: 'sheet',
      path: '/tmp/test/sheet_v1.png',
      content_hash: 'hash1',
      is_canonical: true,
    });

    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var_art2',
      artifact_type: 'sheet',
      path: '/tmp/test/sheet_v2.png',
      content_hash: 'hash2',
      is_canonical: true,
    });

    // Each variant has its own canonical
    const canonical1 = getCanonicalArtifact(db, 'var_art1', 'sheet');
    expect(canonical1).toBeDefined();
    expect(canonical1!.path).toBe('/tmp/test/sheet_v1.png');

    const canonical2 = getCanonicalArtifact(db, 'var_art2', 'sheet');
    expect(canonical2).toBeDefined();
    expect(canonical2!.path).toBe('/tmp/test/sheet_v2.png');
    expect(canonical2!.content_hash).toBe('hash2');
  });

  it('lists artifacts filtered by type', () => {
    // Use separate variants to avoid ID collision from same millisecond
    upsertVariant(db, { id: 'var_filt1', character_id: 'char1', variant_type: 'base' });
    upsertVariant(db, { id: 'var_filt2', character_id: 'char1', variant_type: 'alt' });

    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var_filt1',
      artifact_type: 'concept_candidate',
      path: '/tmp/test/c1.png',
    });
    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var_filt2',
      artifact_type: 'concept_candidate',
      path: '/tmp/test/c2.png',
    });
    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var_filt1',
      artifact_type: 'sheet',
      path: '/tmp/test/sheet.png',
    });

    const concepts = getArtifacts(db, 'var_filt1', 'concept_candidate');
    expect(concepts).toHaveLength(1);

    const concepts2 = getArtifacts(db, 'var_filt2', 'concept_candidate');
    expect(concepts2).toHaveLength(1);

    const sheets = getArtifacts(db, 'var_filt1', 'sheet');
    expect(sheets).toHaveLength(1);

    const all = getArtifacts(db, 'var_filt1');
    expect(all).toHaveLength(2);
  });

  it('computeFileHash returns null for nonexistent file', () => {
    const hash = computeFileHash('/nonexistent/path/file.png');
    expect(hash).toBeNull();
  });

  it('getCanonicalArtifact with direction filter', () => {
    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var1',
      artifact_type: 'directional_locked',
      direction: 'front',
      path: '/tmp/test/front.png',
      is_canonical: true,
    });
    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var1',
      artifact_type: 'directional_locked',
      direction: 'side',
      path: '/tmp/test/side.png',
      is_canonical: true,
    });

    const front = getCanonicalArtifact(db, 'var1', 'directional_locked', 'front');
    expect(front).toBeDefined();
    expect(front!.direction).toBe('front');

    const side = getCanonicalArtifact(db, 'var1', 'directional_locked', 'side');
    expect(side).toBeDefined();
    expect(side!.direction).toBe('side');

    const back = getCanonicalArtifact(db, 'var1', 'directional_locked', 'back');
    expect(back).toBeUndefined();
  });

  it('non-canonical artifacts are excluded from getCanonicalArtifact', () => {
    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var1',
      artifact_type: 'sheet',
      path: '/tmp/test/sheet_draft.png',
      is_canonical: false,
    });
    const canonical = getCanonicalArtifact(db, 'var1', 'sheet');
    expect(canonical).toBeUndefined();
  });
});

// ─── Next Step ────────────────────────────────────────────

describe('next-step', () => {
  it('returns start_concept_batch for draft variant', () => {
    const step = getNextStep(db, 'var1');
    expect(step.production_state).toBe('draft');
    expect(step.next_action).toContain('concept batch');
    expect(step.variant_id).toBe('var1');
  });

  it('returns lock directional picks with missing directions', () => {
    // Advance to directional_batch_started
    transitionState(db, 'var1', 'concept_batch_started');
    transitionState(db, 'var1', 'concept_candidates_recorded');
    transitionState(db, 'var1', 'concept_locked');
    transitionState(db, 'var1', 'directional_batch_started');

    // Lock only 2 of 5 directions
    lockPick(db, { variant_id: 'var1', pick_type: 'directional', direction: 'front', candidate_name: 'f.png' });
    lockPick(db, { variant_id: 'var1', pick_type: 'directional', direction: 'side', candidate_name: 's.png' });

    const step = getNextStep(db, 'var1');
    expect(step.production_state).toBe('directional_batch_started');
    expect(step.missing_locks).toContain('front_34');
    expect(step.missing_locks).toContain('back_34');
    expect(step.missing_locks).toContain('back');
    expect(step.missing_locks).toHaveLength(3);
    expect(step.next_action).toContain('Lock directional picks');
  });

  it('returns assemble_sheet when all directions locked', () => {
    // Advance to directional_locked
    transitionState(db, 'var1', 'concept_batch_started');
    transitionState(db, 'var1', 'concept_candidates_recorded');
    transitionState(db, 'var1', 'concept_locked');
    transitionState(db, 'var1', 'directional_batch_started');
    transitionState(db, 'var1', 'directional_locked');

    // Lock all 5 directions
    for (const dir of ['front', 'front_34', 'side', 'back_34', 'back']) {
      lockPick(db, { variant_id: 'var1', pick_type: 'directional', direction: dir, candidate_name: `${dir}.png` });
    }

    const step = getNextStep(db, 'var1');
    expect(step.production_state).toBe('directional_locked');
    expect(step.next_action).toContain('Assemble 8-dir sheet');
    expect(step.blockers).toHaveLength(0);
  });

  it('returns sync_pack for pack_sliced variant', () => {
    // Advance through the lifecycle to pack_sliced
    transitionState(db, 'var1', 'concept_batch_started');
    transitionState(db, 'var1', 'concept_candidates_recorded');
    transitionState(db, 'var1', 'concept_locked');
    transitionState(db, 'var1', 'directional_batch_started');
    transitionState(db, 'var1', 'directional_locked');
    transitionState(db, 'var1', 'sheet_assembled');
    transitionState(db, 'var1', 'pack_sliced');

    const step = getNextStep(db, 'var1');
    expect(step.production_state).toBe('pack_sliced');
    expect(step.next_action).toContain('Sync pack to engine');
  });

  it('returns frozen for frozen variant', () => {
    // Walk through full lifecycle
    const states = [
      'concept_batch_started', 'concept_candidates_recorded', 'concept_locked',
      'directional_batch_started', 'directional_locked', 'sheet_assembled',
      'pack_sliced', 'engine_synced', 'proved', 'frozen',
    ] as const;
    for (const s of states) {
      transitionState(db, 'var1', s);
    }

    const step = getNextStep(db, 'var1');
    expect(step.production_state).toBe('frozen');
    expect(step.next_action).toContain('Frozen');
  });

  it('throws for nonexistent variant', () => {
    expect(() => getNextStep(db, 'nonexistent')).toThrow(/Variant not found/);
  });
});

// ─── Timeline ─────────────────────────────────────────────

describe('timeline', () => {
  it('returns empty timeline for variant with no events', () => {
    const timeline = getVariantTimeline(db, 'var1');
    expect(timeline).toHaveLength(0);
  });

  it('merges state events, batches, picks, artifacts in chronological order', () => {
    // Create a state event
    transitionState(db, 'var1', 'concept_batch_started');

    // Create a batch
    createBatch(db, { variant_id: 'var1', batch_type: 'concept', candidate_count: 4 });

    // Lock a pick
    lockPick(db, { variant_id: 'var1', pick_type: 'concept', candidate_name: 'c1.png' });

    // Register an artifact
    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var1',
      artifact_type: 'concept_locked',
      path: '/tmp/test/locked.png',
      is_canonical: true,
    });

    const timeline = getVariantTimeline(db, 'var1');
    expect(timeline.length).toBeGreaterThanOrEqual(4);

    const types = timeline.map(e => e.type);
    expect(types).toContain('state_change');
    expect(types).toContain('batch');
    expect(types).toContain('pick');
    expect(types).toContain('artifact');

    // Each entry has a timestamp and summary
    for (const entry of timeline) {
      expect(entry.timestamp).toBeDefined();
      expect(entry.summary).toBeDefined();
      expect(typeof entry.summary).toBe('string');
    }
  });

  it('getCharacterTimeline merges across multiple variants', () => {
    // Create second variant for same character
    upsertVariant(db, { id: 'var2', character_id: 'char1', variant_type: 'phase2' });

    // Add events to both variants
    transitionState(db, 'var1', 'concept_batch_started');
    transitionState(db, 'var2', 'concept_batch_started');

    createBatch(db, { variant_id: 'var1', batch_type: 'concept', candidate_count: 4 });
    createBatch(db, { variant_id: 'var2', batch_type: 'concept', candidate_count: 3 });

    const timeline = getCharacterTimeline(db, 'char1');
    expect(timeline.length).toBeGreaterThanOrEqual(4);

    // Both variants should appear
    const variantIds = new Set(timeline.map(e => e.detail.variant_id));
    expect(variantIds.has('var1')).toBe(true);
    expect(variantIds.has('var2')).toBe(true);
  });

  it('timeline entries are sorted chronologically', () => {
    transitionState(db, 'var1', 'concept_batch_started');
    transitionState(db, 'var1', 'concept_candidates_recorded');
    createBatch(db, { variant_id: 'var1', batch_type: 'concept', candidate_count: 4 });

    const timeline = getVariantTimeline(db, 'var1');
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].timestamp >= timeline[i - 1].timestamp).toBe(true);
    }
  });

  it('non-canonical artifacts excluded from timeline', () => {
    registerArtifact(db, {
      project_id: 'test',
      variant_id: 'var1',
      artifact_type: 'concept_candidate',
      path: '/tmp/test/draft.png',
      is_canonical: false,
    });

    const timeline = getVariantTimeline(db, 'var1');
    const artifactEntries = timeline.filter(e => e.type === 'artifact');
    expect(artifactEntries).toHaveLength(0);
  });
});
