#!/usr/bin/env node
/**
 * Bootstrap scanner for The Fractured Road.
 * Reads manifest.json + encounter_data.gd + filesystem to seed the production registry.
 * Idempotent — safe to run multiple times.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
  updateVariantPresence,
  upsertPack,
  updatePackCounts,
  upsertEncounter,
  addEnemy,
  clearEnemies,
  addFreezeEntry,
  setProductionState,
  validateBounds,
  validateFormation,
  validateVariants,
} from '@mcptoolshop/game-foundry-registry';
import type Database from 'better-sqlite3';

const PROJECT_ID = 'the-fractured-road';
const PROJECT_NAME = 'The Fractured Road';

// ─── Party definitions ──────────────────────────────────────

const PARTY_MEMBERS = [
  { id: 'maren', display_name: 'Maren', role: 'party' as const, family: 'party', faction: 'party' },
  { id: 'sable', display_name: 'Sable', role: 'party' as const, family: 'party', faction: 'party' },
  { id: 'drift', display_name: 'Drift', role: 'party' as const, family: 'party', faction: 'party' },
  { id: 'wynn', display_name: 'Wynn', role: 'party' as const, family: 'party', faction: 'party' },
  { id: 'vael', display_name: 'Vael', role: 'party' as const, family: 'party', faction: 'party' },
  { id: 'thresh', display_name: 'Thresh', role: 'party' as const, family: 'party', faction: 'party' },
];

// ─── Encounter data (matches the corrected encounter_data.gd) ────

interface EncounterDef {
  id: string;
  label: string;
  doctrine: string;
  maxTurns: number;
  description: string;
  enemies: Array<{
    name: string;
    variant: string;
    pack: string;
    aiRole: string;
    row: number;
    col: number;
    hp: number;
    guard: number;
    speed: number;
    move: number;
    engine?: Record<string, unknown>;
  }>;
}

const ENCOUNTERS: EncounterDef[] = [
  {
    id: 'goblin_opener', label: 'Raider Ambush', doctrine: 'opportunist', maxTurns: 16,
    description: 'First encounter: goblin raider ambush.',
    enemies: [
      { name: 'Grubblade', variant: 'grubblade', pack: 'ch1-enemies', aiRole: 'center_holder', row: 1, col: 5, hp: 8, guard: 3, speed: 9, move: 3 },
      { name: 'Needler', variant: 'needler', pack: 'ch1-enemies', aiRole: 'ranged_pressure', row: 0, col: 7, hp: 5, guard: 2, speed: 12, move: 4 },
      { name: 'Redknife', variant: 'redknife', pack: 'ch1-enemies', aiRole: 'executioner', row: 2, col: 6, hp: 6, guard: 2, speed: 11, move: 4 },
    ],
  },
  {
    id: 'goblin_full', label: 'Goblin War Party', doctrine: 'opportunist', maxTurns: 20,
    description: 'Full raiding party. Four goblin roles working together.',
    enemies: [
      { name: 'Grubblade', variant: 'grubblade', pack: 'ch1-enemies', aiRole: 'center_holder', row: 1, col: 5, hp: 9, guard: 4, speed: 9, move: 3 },
      { name: 'Needler', variant: 'needler', pack: 'ch1-enemies', aiRole: 'ranged_pressure', row: 0, col: 7, hp: 5, guard: 2, speed: 12, move: 4 },
      { name: 'Snarejack', variant: 'snarejack', pack: 'ch1-enemies', aiRole: 'disruptor', row: 2, col: 6, hp: 7, guard: 3, speed: 10, move: 3 },
      { name: 'Redknife', variant: 'redknife', pack: 'ch1-enemies', aiRole: 'executioner', row: 1, col: 7, hp: 7, guard: 2, speed: 11, move: 4 },
    ],
  },
  {
    id: 'undead_first', label: 'Quarantine Breach', doctrine: 'persistence', maxTurns: 18,
    description: 'Dead militia at the perimeter. Still holding the line.',
    enemies: [
      { name: 'Riot Husk', variant: 'riot_husk', pack: 'ch1-enemies', aiRole: 'anchor', row: 1, col: 5, hp: 10, guard: 4, speed: 6, move: 2 },
      { name: 'Grave Runner', variant: 'grave_runner', pack: 'ch1-enemies', aiRole: 'pressure', row: 0, col: 6, hp: 6, guard: 2, speed: 11, move: 4 },
      { name: 'Grave Runner', variant: 'grave_runner', pack: 'ch1-enemies', aiRole: 'pressure', row: 2, col: 6, hp: 6, guard: 2, speed: 11, move: 4 },
    ],
  },
  {
    id: 'undead_cleanup', label: 'Corpse Road', doctrine: 'persistence', maxTurns: 20,
    description: 'Road-clearing dead. Militia insignia still visible.',
    enemies: [
      { name: 'Riot Husk', variant: 'riot_husk', pack: 'ch1-enemies', aiRole: 'anchor', row: 1, col: 5, hp: 10, guard: 5, speed: 6, move: 2 },
      { name: 'Chain Drudge', variant: 'chain_drudge', pack: 'ch1-enemies', aiRole: 'disruptor', row: 0, col: 6, hp: 9, guard: 4, speed: 7, move: 2 },
      { name: 'Grave Runner', variant: 'grave_runner', pack: 'ch1-enemies', aiRole: 'pressure', row: 2, col: 7, hp: 6, guard: 2, speed: 11, move: 4 },
      { name: 'Fume Bearer', variant: 'fume_bearer', pack: 'ch1-enemies', aiRole: 'support', row: 2, col: 5, hp: 7, guard: 3, speed: 8, move: 2 },
    ],
  },
  {
    id: 'bell_warden_micro', label: 'Toll Passage', doctrine: 'territorial', maxTurns: 12,
    description: 'Confined corridor. Something grown from quarantine and sound.',
    enemies: [
      { name: 'Bell Warden', variant: 'bell_warden', pack: 'ch1-enemies', aiRole: 'territorial_boss', row: 1, col: 6, hp: 16, guard: 6, speed: 7, move: 1 },
    ],
  },
  {
    id: 'undead_doctrine', label: 'Contamination Zone', doctrine: 'persistence', maxTurns: 24,
    description: "The zone's worst. Fungal contamination mixed with militia dead.",
    enemies: [
      { name: 'Rot Bloater', variant: 'rot_bloater', pack: 'ch1-enemies', aiRole: 'executioner', row: 1, col: 5, hp: 14, guard: 5, speed: 5, move: 2 },
      { name: 'Chain Drudge', variant: 'chain_drudge', pack: 'ch1-enemies', aiRole: 'disruptor', row: 0, col: 6, hp: 9, guard: 4, speed: 7, move: 2 },
      { name: 'Fume Bearer', variant: 'fume_bearer', pack: 'ch1-enemies', aiRole: 'support', row: 2, col: 7, hp: 8, guard: 3, speed: 8, move: 2 },
      { name: 'Grave Runner', variant: 'grave_runner', pack: 'ch1-enemies', aiRole: 'pressure', row: 0, col: 5, hp: 7, guard: 2, speed: 11, move: 4 },
      { name: 'Riot Husk', variant: 'riot_husk', pack: 'ch1-enemies', aiRole: 'anchor', row: 2, col: 5, hp: 10, guard: 5, speed: 6, move: 2 },
    ],
  },
  {
    id: 'avar_boss', label: "The Marshal's Line", doctrine: 'boss', maxTurns: 28,
    description: 'Marshal Avar and the line he will not abandon.',
    enemies: [
      {
        name: 'Marshal Avar', variant: 'avar_armed', pack: 'ch1-enemies', aiRole: 'boss',
        row: 1, col: 6, hp: 18, guard: 8, speed: 9, move: 2,
        engine: { phase: 1, phase2_variant: 'avar_desperate', transition_hp: 8, command_cooldown: 0, conviction_stacks: 0 },
      },
      { name: 'Road Militia', variant: 'riot_husk', pack: 'ch1-enemies', aiRole: 'anchor', row: 0, col: 5, hp: 8, guard: 3, speed: 8, move: 3, engine: { militia_type: 'road_guard' } },
      { name: 'Road Militia', variant: 'riot_husk', pack: 'ch1-enemies', aiRole: 'anchor', row: 2, col: 5, hp: 8, guard: 3, speed: 8, move: 3, engine: { militia_type: 'road_guard' } },
    ],
  },
];

// ─── Main bootstrap ─────────────────────────────────────────

export function bootstrap(db: Database.Database, projectRoot: string): {
  characters: number;
  variants: number;
  encounters: number;
  packs: number;
  validation: { bounds_pass: number; bounds_fail: number; formation_pass: number; formation_fail: number };
} {
  const stats = { characters: 0, variants: 0, encounters: 0, packs: 0, validation: { bounds_pass: 0, bounds_fail: 0, formation_pass: 0, formation_fail: 0 } };

  // Step 1: Register project
  upsertProject(db, PROJECT_ID, PROJECT_NAME, projectRoot);

  // Step 2: Read manifest
  const manifestPath = path.join(projectRoot, 'assets/sprites/ch1-enemies/manifest.json');
  let manifest: {
    pack: string; chapter: number; sprite_size: number; directions: number;
    characters: Array<{ variant: string; family: string; ai_role: string; phase?: number; encounters: string[] }>;
    freeze_date: string;
  } | undefined;

  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  // Step 3: Register enemy pack
  if (manifest) {
    upsertPack(db, {
      id: manifest.pack,
      project_id: PROJECT_ID,
      pack_type: 'enemy',
      chapter: `ch${manifest.chapter}`,
      sprite_size: manifest.sprite_size,
      directions: manifest.directions,
      root_path: `assets/sprites/${manifest.pack}`,
      manifest_path: `assets/sprites/${manifest.pack}/manifest.json`,
    });
    stats.packs++;

    // Step 4: Register enemy characters + variants from manifest
    for (const entry of manifest.characters) {
      const charId = entry.variant.replace(/_armed$|_desperate$/, '');
      const role = entry.family === 'boss' ? 'boss' : 'enemy';

      upsertCharacter(db, {
        id: charId,
        project_id: PROJECT_ID,
        display_name: formatName(charId),
        role,
        family: entry.family,
        ai_role: entry.ai_role,
        chapter_primary: `ch${manifest.chapter}`,
      });
      stats.characters++;

      const variantType = entry.phase === 2 ? 'phase2' : 'base';
      const packDir = `assets/sprites/${manifest.pack}/assets/${entry.variant}/albedo`;
      const dirPresent = countPackDirections(projectRoot, packDir);

      upsertVariant(db, {
        id: entry.variant,
        character_id: charId,
        variant_type: variantType,
        pack_id: manifest.pack,
        phase: entry.phase ?? (variantType === 'base' ? 1 : undefined),
        pack_dir: packDir,
        directional_dir: `assets/sprites/directional/${entry.variant}`,
        concept_dir: `assets/sprites/concepts/${entry.variant}`,
      });

      updateVariantPresence(db, entry.variant, {
        pack_present: dirPresent >= 8 ? 1 : 0,
        directions_present: dirPresent,
      });
      stats.variants++;

      // Mark production states based on filesystem
      const fullStates = deriveProductionStates(projectRoot, charId, entry.variant, manifest.pack);
      for (const [field, value] of Object.entries(fullStates)) {
        try { setProductionState(db, charId, field, value as any); } catch { /* already set */ }
      }
    }

    // Update pack counts
    const memberCount = manifest.characters.length;
    const completeCount = manifest.characters.filter(c => {
      const packDir = `assets/sprites/${manifest!.pack}/assets/${c.variant}/albedo`;
      return countPackDirections(projectRoot, packDir) >= 8;
    }).length;
    updatePackCounts(db, manifest.pack, memberCount, completeCount);
  }

  // Step 5: Register party characters + pack
  upsertPack(db, {
    id: 'party',
    project_id: PROJECT_ID,
    pack_type: 'party',
    sprite_size: 48,
    directions: 8,
    root_path: 'assets/sprites/party',
  });
  stats.packs++;

  for (const member of PARTY_MEMBERS) {
    upsertCharacter(db, { ...member, project_id: PROJECT_ID, chapter_primary: 'ch1' });
    stats.characters++;

    upsertVariant(db, {
      id: member.id,
      character_id: member.id,
      variant_type: 'base',
      pack_id: 'party',
      directional_dir: `assets/sprites/directional/${member.id}`,
      concept_dir: `assets/sprites/concepts/${member.id}`,
      pack_dir: `assets/sprites/party/assets/${member.id}/albedo`,
    });

    const dirPresent = countDirectionalDirs(projectRoot, member.id);
    const packPresent = countPackDirections(projectRoot, `assets/sprites/party/assets/${member.id}/albedo`);

    updateVariantPresence(db, member.id, {
      directions_present: dirPresent,
      pack_present: packPresent >= 8 ? 1 : 0,
    });
    stats.variants++;

    const states = deriveProductionStates(projectRoot, member.id, member.id, 'party');
    for (const [field, value] of Object.entries(states)) {
      try { setProductionState(db, member.id, field, value as any); } catch { /* already set */ }
    }
  }

  // Step 6: Register encounters
  for (const enc of ENCOUNTERS) {
    upsertEncounter(db, {
      id: enc.id,
      project_id: PROJECT_ID,
      chapter: 'ch1',
      label: enc.label,
      doctrine: enc.doctrine,
      max_turns: enc.maxTurns,
      description: enc.description,
      grid_rows: 3,
      grid_cols: 8,
    });

    clearEnemies(db, enc.id);
    for (let i = 0; i < enc.enemies.length; i++) {
      const e = enc.enemies[i];
      addEnemy(db, {
        encounter_id: enc.id,
        display_name: e.name,
        variant_id: e.variant,
        sprite_pack: e.pack,
        ai_role: e.aiRole,
        grid_row: e.row,
        grid_col: e.col,
        hp: e.hp,
        guard: e.guard,
        speed: e.speed,
        move_range: e.move,
        engine_data: e.engine,
        sort_order: i,
      });
    }
    stats.encounters++;

    // Validate
    const bounds = validateBounds(db, enc.id);
    bounds.pass ? stats.validation.bounds_pass++ : stats.validation.bounds_fail++;
    const formation = validateFormation(db, enc.id);
    formation.pass ? stats.validation.formation_pass++ : stats.validation.formation_fail++;
  }

  // Step 7: Freeze entries for Ch1
  if (manifest?.freeze_date) {
    addFreezeEntry(db, 'chapter', 'ch1', undefined, 'bootstrap', `Frozen ${manifest.freeze_date}`);
  }

  return stats;
}

// ─── Helpers ────────────────────────────────────────────────

function formatName(id: string): string {
  return id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function countPackDirections(projectRoot: string, packDir: string): number {
  const absDir = path.join(projectRoot, packDir);
  if (!fs.existsSync(absDir)) return 0;
  const files = fs.readdirSync(absDir).filter(f => f.endsWith('.png'));
  return files.length;
}

function countDirectionalDirs(projectRoot: string, charId: string): number {
  const dirPath = path.join(projectRoot, 'assets/sprites/directional', charId);
  if (!fs.existsSync(dirPath)) return 0;
  const expected = ['front', 'front_34', 'side', 'back_34', 'back'];
  return expected.filter(d => fs.existsSync(path.join(dirPath, d))).length;
}

function deriveProductionStates(projectRoot: string, charId: string, variantId: string, packId: string): Record<string, string> {
  const states: Record<string, string> = {};

  // Concepts
  const conceptDir = path.join(projectRoot, 'assets/sprites/concepts', charId);
  if (fs.existsSync(conceptDir)) {
    const concepts = fs.readdirSync(conceptDir).filter(f => f.endsWith('.png'));
    states.concept_status = concepts.length > 0 ? 'complete' : 'none';
  }

  // Directionals
  const dirCount = countDirectionalDirs(projectRoot, charId);
  if (dirCount >= 5) states.directional_status = 'complete';
  else if (dirCount > 0) states.directional_status = 'in_progress';

  // Sheets
  const sheetDir = path.join(projectRoot, 'assets/sprites/sheets', charId);
  if (fs.existsSync(sheetDir)) {
    const sheets = fs.readdirSync(sheetDir).filter(f => f.includes('8dir') && f.endsWith('.png'));
    states.sheet_status = sheets.length > 0 ? 'complete' : 'none';
  }

  // Pack
  const packDir = path.join(projectRoot, 'assets/sprites', packId, 'assets', variantId, 'albedo');
  if (fs.existsSync(packDir)) {
    const pngs = fs.readdirSync(packDir).filter(f => f.endsWith('.png'));
    states.pack_status = pngs.length >= 8 ? 'complete' : 'in_progress';
  }

  // Integration (if pack is complete, consider integrated)
  if (states.pack_status === 'complete') states.integration_status = 'complete';

  return states;
}

// ─── CLI ────────────────────────────────────────────────────

if (process.argv[1] && process.argv[1].includes('scan-tfr')) {
  const projectRoot = process.argv[2] || 'F:/AI/the-fractured-road';
  console.log(`Bootstrapping from: ${projectRoot}`);

  const db = openDatabase();
  const stats = bootstrap(db, projectRoot);
  db.close();

  console.log(`\n═══ Bootstrap Complete ═══`);
  console.log(`  Characters: ${stats.characters}`);
  console.log(`  Variants:   ${stats.variants}`);
  console.log(`  Encounters: ${stats.encounters}`);
  console.log(`  Packs:      ${stats.packs}`);
  console.log(`  Bounds:     ${stats.validation.bounds_pass} pass, ${stats.validation.bounds_fail} fail`);
  console.log(`  Formation:  ${stats.validation.formation_pass} pass, ${stats.validation.formation_fail} fail`);
}
