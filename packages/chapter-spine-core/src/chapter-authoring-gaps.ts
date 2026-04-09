import type Database from 'better-sqlite3';
import type {
  ChapterAuthoringGapsResult,
  AuthoringGap,
  AuthoringGapSeverity,
  AuthoringGapDomain,
} from '@mcptoolshop/game-foundry-registry';
import {
  getChapter,
  listEncounters,
  getEncounterEnemies,
  getSceneContractByEncounter,
  getLayersByContract,
  getAuthoringDefaults,
} from '@mcptoolshop/game-foundry-registry';

/**
 * Compute authoring gaps for a chapter: what's missing for each encounter
 * to reach production readiness. Surfaces blockers early, before the chapter
 * is "done" — the missing-input pressure system.
 */
export function computeAuthoringGaps(
  db: Database.Database,
  chapterId: string,
): ChapterAuthoringGapsResult {
  const chapter = getChapter(db, chapterId);
  if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);

  const defaults = getAuthoringDefaults(db, chapterId);
  const requireScene = defaults ? defaults.require_scene_contract === 1 : true;
  const requireLayers = defaults ? defaults.require_ui_layers === 1 : true;
  const requireCanon = defaults ? defaults.require_canon_link === 1 : false;

  const encounters = listEncounters(db, { project_id: chapter.project_id, chapter: chapterId });
  const gaps: AuthoringGap[] = [];

  // Chapter-level: encounter count
  if (chapter.required_encounter_count != null && encounters.length < chapter.required_encounter_count) {
    gaps.push({
      encounter_id: null,
      domain: 'encounter_count',
      gap_type: 'insufficient_encounters',
      description: `Chapter needs ${chapter.required_encounter_count} encounters but has ${encounters.length}`,
      severity: 'warning',
    });
  }

  for (const enc of encounters) {
    const enemies = getEncounterEnemies(db, enc.id);

    // 1. Roster check
    if (enemies.length === 0) {
      gaps.push({
        encounter_id: enc.id,
        domain: 'roster',
        gap_type: 'no_roster',
        description: `${enc.display_name || enc.label} has no units`,
        severity: 'blocker',
      });
    }

    // 2. Variant registry check
    for (const enemy of enemies) {
      const variant = db.prepare('SELECT id FROM variants WHERE id = ?').get(enemy.variant_id);
      if (!variant) {
        gaps.push({
          encounter_id: enc.id,
          domain: 'variant_registry',
          gap_type: 'missing_variant',
          description: `${enc.display_name || enc.label}: variant '${enemy.variant_id}' not registered`,
          severity: 'blocker',
        });
      }
    }

    // 3. Sprite pack check
    for (const enemy of enemies) {
      const pack = db.prepare('SELECT id FROM asset_packs WHERE id = ?').get(enemy.sprite_pack);
      if (!pack) {
        gaps.push({
          encounter_id: enc.id,
          domain: 'sprite_pack',
          gap_type: 'missing_pack',
          description: `${enc.display_name || enc.label}: sprite pack '${enemy.sprite_pack}' not found`,
          severity: 'blocker',
        });
      }
    }

    // 4. Scene contract check
    const contract = getSceneContractByEncounter(db, enc.id);
    if (!contract && requireScene) {
      gaps.push({
        encounter_id: enc.id,
        domain: 'scene_contract',
        gap_type: 'no_scene_contract',
        description: `${enc.display_name || enc.label} has no battle scene contract`,
        severity: 'blocker',
      });
    }

    // 5. UI layers check
    if (contract && requireLayers) {
      const layers = getLayersByContract(db, contract.id);
      if (layers.length < 5) {
        gaps.push({
          encounter_id: enc.id,
          domain: 'ui_layers',
          gap_type: 'missing_layers',
          description: `${enc.display_name || enc.label} has ${layers.length}/5 UI layers configured`,
          severity: 'blocker',
        });
      }
    }

    // 6. Canon link check
    if (requireCanon) {
      const canonLink = db.prepare(
        "SELECT id FROM canon_links WHERE target_type = 'encounter' AND target_id = ?"
      ).get(enc.id);
      if (!canonLink) {
        gaps.push({
          encounter_id: enc.id,
          domain: 'canon',
          gap_type: 'no_canon_link',
          description: `${enc.display_name || enc.label} has no canon documentation link`,
          severity: 'warning',
        });
      }
    }
  }

  const blockerCount = gaps.filter(g => g.severity === 'blocker').length;
  const warningCount = gaps.filter(g => g.severity === 'warning').length;

  return {
    chapter_id: chapterId,
    project_id: chapter.project_id,
    total_gaps: gaps.length,
    blocker_count: blockerCount,
    warning_count: warningCount,
    gaps,
  };
}
