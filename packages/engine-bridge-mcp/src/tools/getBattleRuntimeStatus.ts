import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import {
  getProject, listCharacters, listVariantsForCharacter,
  listPacks, listEncounters, validateBounds, validateFormation, validateVariants,
} from '@mcptoolshop/game-foundry-registry';
import { packAlbedoDir, countDirectionFiles, checkPortraits } from '../utils/godot.js';

export interface BattleRuntimeStatus {
  project_id: string;
  party: {
    total: number;
    complete: number;
    placeholders: string[];
  };
  enemy_packs: Array<{
    pack_id: string;
    members: number;
    complete: number;
  }>;
  encounters: {
    total: number;
    bounds_pass: number;
    formation_pass: number;
    variants_pass: number;
  };
  boss_phases: Array<{
    character: string;
    phase1_ok: boolean;
    phase2_ok: boolean;
  }>;
  portraits: {
    have: string[];
    missing: string[];
  };
  overall_ready: boolean;
}

export function getBattleRuntimeStatus(db: Database.Database, projectId: string): BattleRuntimeStatus {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const allChars = listCharacters(db, { project_id: projectId });
  const partyChars = allChars.filter(c => c.role === 'party');

  // Party pack status
  const partyPlaceholders: string[] = [];
  let partyComplete = 0;
  for (const pc of partyChars) {
    const variants = listVariantsForCharacter(db, pc.id);
    const baseVariant = variants.find(v => v.variant_type === 'base');
    if (!baseVariant?.pack_id) {
      partyPlaceholders.push(pc.display_name);
      continue;
    }
    const absDir = packAlbedoDir(project.root_path, baseVariant.pack_id, baseVariant.id);
    const counts = countDirectionFiles(absDir);
    if (counts.pngs >= 8 && counts.imports >= 8) {
      partyComplete++;
    } else {
      partyPlaceholders.push(pc.display_name);
    }
  }

  // Enemy packs
  const packs = listPacks(db, projectId);
  const enemyPacks = packs.filter(p => p.pack_type === 'enemy' || p.pack_type === 'boss');
  const enemyPackStatus = enemyPacks.map(pack => {
    const members = allChars.filter(c => {
      const variants = listVariantsForCharacter(db, c.id);
      return variants.some(v => v.pack_id === pack.id);
    });
    let complete = 0;
    for (const m of members) {
      const variants = listVariantsForCharacter(db, m.id);
      for (const v of variants) {
        if (v.pack_id !== pack.id) continue;
        const absDir = packAlbedoDir(project.root_path, pack.id, v.id);
        const counts = countDirectionFiles(absDir);
        if (counts.pngs >= 8) complete++;
      }
    }
    return { pack_id: pack.id, members: members.length, complete };
  });

  // Encounters
  const encounters = listEncounters(db, { project_id: projectId });
  let boundsPass = 0, formationPass = 0, variantsPass = 0;
  for (const enc of encounters) {
    try { if (validateBounds(db, enc.id).pass) boundsPass++; } catch { /* */ }
    try { if (validateFormation(db, enc.id).pass) formationPass++; } catch { /* */ }
    try { if (validateVariants(db, enc.id).pass) variantsPass++; } catch { /* */ }
  }

  // Boss phases
  const bossChars = allChars.filter(c => c.role === 'boss');
  const bossPhases = bossChars.map(bc => {
    const variants = listVariantsForCharacter(db, bc.id);
    const phase1 = variants.find(v => v.variant_type === 'base');
    const phase2 = variants.find(v => v.variant_type === 'phase2');

    const p1Ok = !!(phase1?.pack_id && (() => {
      const dir = packAlbedoDir(project.root_path, phase1.pack_id!, phase1.id);
      return countDirectionFiles(dir).pngs >= 8;
    })());

    const p2Ok = !!(phase2?.pack_id && (() => {
      const dir = packAlbedoDir(project.root_path, phase2.pack_id!, phase2.id);
      return countDirectionFiles(dir).pngs >= 8;
    })());

    return { character: bc.display_name, phase1_ok: p1Ok, phase2_ok: p2Ok };
  });

  // Portraits
  const portraitHave: string[] = [];
  const portraitMissing: string[] = [];
  for (const char of allChars) {
    const ports = checkPortraits(project.root_path, char.display_name);
    if (ports.has_80 || ports.has_28) {
      portraitHave.push(char.display_name);
    } else {
      portraitMissing.push(char.display_name);
    }
  }

  const overallReady =
    partyPlaceholders.length === 0 &&
    boundsPass === encounters.length &&
    formationPass === encounters.length &&
    variantsPass === encounters.length &&
    bossPhases.every(bp => bp.phase1_ok && (bp.phase2_ok || !bp.phase2_ok));

  return {
    project_id: projectId,
    party: { total: partyChars.length, complete: partyComplete, placeholders: partyPlaceholders },
    enemy_packs: enemyPackStatus,
    encounters: { total: encounters.length, bounds_pass: boundsPass, formation_pass: formationPass, variants_pass: variantsPass },
    boss_phases: bossPhases,
    portraits: { have: portraitHave, missing: portraitMissing },
    overall_ready: overallReady,
  };
}

export function registerGetBattleRuntimeStatus(server: McpServer, db: Database.Database): void {
  server.tool(
    'get_battle_runtime_status',
    'Single truth surface for a project\'s combat readiness: party, enemies, encounters, bosses, portraits',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = getBattleRuntimeStatus(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
