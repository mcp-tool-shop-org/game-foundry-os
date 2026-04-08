import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseProjectGodot } from '../utils/godot-project.js';

export interface ShellCheck {
  check: string;
  pass: boolean;
  detail: string;
}

export interface TemplateShellVerifyResult {
  project_id: string;
  checks: ShellCheck[];
  pass: boolean;
  missing_shells: string[];
  next_repair: string;
}

const REQUIRED_SHELLS = [
  { file: 'battle/scripts/battle_scene.gd', label: 'battle_scene.gd' },
  { file: 'battle/scripts/combat_hud.gd', label: 'combat_hud.gd' },
  { file: 'globals/sprite_loader.gd', label: 'sprite_loader.gd' },
  { file: 'globals/encounter_loader.gd', label: 'encounter_loader.gd' },
  { file: 'globals/type_system.gd', label: 'type_system.gd' },
];

const REQUIRED_AUTOLOADS = ['GameState', 'SpriteLoader', 'EncounterLoader'];

export function templateShellVerify(db: Database.Database, projectId: string): TemplateShellVerifyResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const root = project.root_path;
  const checks: ShellCheck[] = [];
  const missingShells: string[] = [];

  // Check required shell files
  for (const shell of REQUIRED_SHELLS) {
    const exists = fs.existsSync(path.join(root, shell.file));
    checks.push({
      check: `${shell.label} exists`,
      pass: exists,
      detail: exists ? shell.file : `Missing: ${shell.file}`,
    });
    if (!exists) missingShells.push(shell.label);
  }

  // Check autoloads from project.godot
  const config = parseProjectGodot(root);
  const autoloadNames = config.autoloads.map(a => a.name);
  for (const required of REQUIRED_AUTOLOADS) {
    const present = autoloadNames.includes(required);
    checks.push({
      check: `Autoload: ${required}`,
      pass: present,
      detail: present ? `${required} registered` : `Missing autoload: ${required}`,
    });
    if (!present) missingShells.push(`autoload:${required}`);
  }

  // Check display settings for 2D pixel art
  const isPixelFriendly = config.display.scale_mode === 'integer' || config.display.stretch_mode === 'canvas_items';
  checks.push({
    check: 'Display settings (2D pixel-friendly)',
    pass: isPixelFriendly,
    detail: isPixelFriendly
      ? `stretch=${config.display.stretch_mode}, scale=${config.display.scale_mode}`
      : 'Expected stretch_mode=canvas_items or scale_mode=integer for pixel art',
  });

  const pass = checks.every(c => c.pass);
  let nextRepair = '';
  if (!pass) {
    const firstFail = checks.find(c => !c.pass);
    nextRepair = firstFail ? `Fix: ${firstFail.detail}` : '';
  }

  return {
    project_id: projectId,
    checks,
    pass,
    missing_shells: missingShells,
    next_repair: nextRepair,
  };
}

export function registerTemplateShellVerify(server: McpServer, db: Database.Database): void {
  server.tool(
    'template_shell_verify',
    'Check that all required Godot shell files (battle scene, HUD, loaders, type system) and autoloads are present',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = templateShellVerify(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
