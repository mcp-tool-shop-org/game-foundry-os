import type Database from 'better-sqlite3';
import type {
  ChapterScaffoldBrief,
  ChapterScaffoldResult,
  ChapterRow,
} from '@mcptoolshop/game-foundry-registry';
import {
  upsertEncounter,
  insertScaffoldReceipt,
} from '@mcptoolshop/game-foundry-registry';
import { createChapter } from './chapter-contract.js';
import { setChapterDefaults, resolveDefaults } from './chapter-defaults.js';
import { createSceneContract, configureDefaultLayers } from '@mcptoolshop/battle-scene-core';
import crypto from 'node:crypto';

/**
 * Scaffold a complete chapter from a brief.
 *
 * Creates: chapter contract, authoring defaults, encounters with inherited defaults,
 * scene contracts per encounter (if required), UI layers (if required).
 * Runs in a single transaction for atomicity.
 */
export function scaffoldChapter(
  db: Database.Database,
  brief: ChapterScaffoldBrief,
): ChapterScaffoldResult {
  const run = db.transaction(() => {
    // 1. Create the chapter
    const chapter = createChapter(db, brief.project_id, brief.chapter_id, brief.display_name, {
      sort_order: brief.sort_order,
      intent_summary: brief.intent_summary,
      required_encounter_count: brief.encounters.length || undefined,
      required_playtest_pass: brief.defaults?.require_playtest_pass,
    });

    // 2. Set authoring defaults
    const defaultsRow = setChapterDefaults(db, {
      chapter_id: brief.chapter_id,
      project_id: brief.project_id,
      ...brief.defaults,
    });

    // 3. Resolve the effective defaults for encounter/scene creation
    const resolved = resolveDefaults(db, brief.chapter_id);

    // 4. Create encounters with inherited defaults
    const encountersCreated: string[] = [];
    const sceneContractsCreated: string[] = [];
    let layersConfigured = 0;

    for (const enc of brief.encounters) {
      // Create the encounter — apply chapter defaults, let encounter-level overrides win
      const encounterType = enc.encounter_type ?? resolved.encounter_type;
      upsertEncounter(db, {
        id: enc.encounter_id,
        project_id: brief.project_id,
        chapter: brief.chapter_id,
        label: enc.display_name,
        grid_rows: resolved.grid_rows,
        grid_cols: resolved.grid_cols,
        max_turns: resolved.max_turns ?? undefined,
      });

      // Set Phase 2 fields (display_name, encounter_type, intent_summary)
      db.prepare(`
        UPDATE encounters SET
          display_name = ?,
          encounter_type = ?,
          intent_summary = COALESCE(?, intent_summary),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(enc.display_name, encounterType, enc.intent_summary ?? null, enc.encounter_id);

      encountersCreated.push(enc.encounter_id);

      // Emit state event for encounter creation
      db.prepare(`
        INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name)
        VALUES (?, 'encounter', ?, 'none', 'draft', 'Scaffolded from chapter brief', 'chapter_scaffold')
      `).run(brief.project_id, enc.encounter_id);

      // 5. Create scene contract if required
      if (resolved.require_scene_contract) {
        const contract = createSceneContract(db, brief.project_id, enc.encounter_id, {
          tile_size_px: resolved.tile_size_px,
          viewport_width: resolved.viewport_width,
          viewport_height: resolved.viewport_height,
        });
        sceneContractsCreated.push(contract.id);

        // 6. Configure UI layers if required
        if (resolved.require_ui_layers) {
          configureDefaultLayers(db, contract.id);
          layersConfigured += 5;
        }
      }
    }

    // 7. Record scaffold receipt
    const receiptId = `csr_${crypto.randomUUID().slice(0, 12)}`;
    insertScaffoldReceipt(db, {
      id: receiptId,
      chapter_id: brief.chapter_id,
      project_id: brief.project_id,
      input_brief_json: JSON.stringify(brief),
      encounters_created: encountersCreated.length,
      scene_contracts_created: sceneContractsCreated.length,
      layers_configured: layersConfigured,
    });

    // 8. Emit scaffold state event
    db.prepare(`
      INSERT INTO state_events (project_id, entity_type, entity_id, from_state, to_state, reason, tool_name, payload_json)
      VALUES (?, 'chapter', ?, 'draft', 'scaffolded', 'Chapter scaffolded from brief', 'chapter_scaffold', ?)
    `).run(
      brief.project_id,
      brief.chapter_id,
      JSON.stringify({
        encounters_created: encountersCreated.length,
        scene_contracts_created: sceneContractsCreated.length,
        layers_configured: layersConfigured,
      }),
    );

    return {
      chapter_id: brief.chapter_id,
      project_id: brief.project_id,
      chapter,
      defaults_applied: defaultsRow,
      encounters_created: encountersCreated,
      scene_contracts_created: sceneContractsCreated,
      layers_configured: layersConfigured,
      receipt_id: receiptId,
    } satisfies ChapterScaffoldResult;
  });

  return run();
}
