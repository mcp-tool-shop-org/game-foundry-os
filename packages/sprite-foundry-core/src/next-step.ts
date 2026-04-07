import type Database from 'better-sqlite3';
import type { VariantProductionState, PortraitState, NextStepResult } from '@mcptoolshop/game-foundry-registry';
import { getLockedPicks, hasAllDirectionalLocks } from './picks.js';
import { getArtifacts } from './artifacts.js';

const REQUIRED_DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

/** Derive the next required action for a variant based on its production state and receipts */
export function getNextStep(db: Database.Database, variantId: string): NextStepResult {
  const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variantId) as
    | { production_state: VariantProductionState; portrait_state: PortraitState; pack_present: number } | undefined;

  if (!variant) throw new Error(`Variant not found: ${variantId}`);

  const state = variant.production_state;
  const portraitState = (variant.portrait_state ?? 'none') as PortraitState;
  const missingLocks: string[] = [];
  const missingArtifacts: string[] = [];
  const blockers: string[] = [];
  let nextAction = '';

  switch (state) {
    case 'draft':
      nextAction = 'Start concept batch (foundry.start_concept_batch)';
      break;

    case 'concept_batch_started':
      nextAction = 'Record concept candidates (foundry.record_concept_candidates)';
      break;

    case 'concept_candidates_recorded':
      nextAction = 'Lock concept pick (foundry.lock_concept_pick)';
      break;

    case 'concept_locked':
      nextAction = 'Start directional batch (foundry.start_directional_batch)';
      break;

    case 'directional_batch_started': {
      // Check which directional locks are missing
      const dirPicks = getLockedPicks(db, variantId, 'directional');
      const lockedDirs = new Set(dirPicks.map(p => p.direction));
      for (const dir of REQUIRED_DIRECTIONS) {
        if (!lockedDirs.has(dir)) {
          missingLocks.push(dir);
        }
      }
      if (missingLocks.length > 0) {
        nextAction = `Lock directional picks: ${missingLocks.join(', ')}`;
      } else {
        nextAction = 'All directions locked — advance to directional_locked';
        blockers.push('State should be directional_locked but is still directional_batch_started');
      }
      break;
    }

    case 'directional_locked': {
      // Verify all 5 directional locks exist
      if (!hasAllDirectionalLocks(db, variantId)) {
        blockers.push('Not all directional picks are locked');
        nextAction = 'Lock remaining directional picks';
      } else {
        nextAction = 'Assemble 8-dir sheet (foundry.assemble_sheet)';
      }
      break;
    }

    case 'sheet_assembled': {
      const sheets = getArtifacts(db, variantId, 'sheet');
      if (sheets.length === 0) {
        missingArtifacts.push('sheet');
        blockers.push('Sheet artifact not registered');
      }
      nextAction = 'Slice pack (foundry.slice_pack)';
      break;
    }

    case 'pack_sliced': {
      const packMembers = getArtifacts(db, variantId, 'pack_member');
      if (packMembers.length < 8) {
        missingArtifacts.push(`pack_member (${packMembers.length}/8)`);
      }
      nextAction = 'Sync pack to engine (foundry.sync_pack_to_engine)';
      break;
    }

    case 'engine_synced':
      nextAction = portraitState === 'none' || portraitState === 'missing'
        ? 'Attach portrait set (foundry.attach_portrait_set) or proceed to proof'
        : 'Run proof (proof.run_asset_integrity)';
      break;

    case 'proved':
      nextAction = 'Freeze variant (proof.freeze_candidate)';
      break;

    case 'frozen':
      nextAction = 'Frozen — no action needed';
      break;

    default:
      nextAction = `Unknown state: ${state}`;
  }

  return {
    variant_id: variantId,
    production_state: state,
    portrait_state: portraitState,
    missing_locks: missingLocks,
    missing_artifacts: missingArtifacts,
    engine_synced: state === 'engine_synced' || state === 'proved' || state === 'frozen',
    next_action: nextAction,
    blockers,
  };
}
