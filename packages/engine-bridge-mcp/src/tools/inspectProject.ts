import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseProjectGodot, type GodotProjectConfig } from '../utils/godot-project.js';

export interface InspectProjectResult {
  project_id: string;
  project_godot_exists: boolean;
  config: GodotProjectConfig;
  checks: Array<{ check: string; pass: boolean; detail: string }>;
  pass: boolean;
}

export function inspectProject(db: Database.Database, projectId: string): InspectProjectResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const config = parseProjectGodot(project.root_path);
  const checks: InspectProjectResult['checks'] = [];

  // Check project.godot exists
  const exists = config.config.name !== '';
  checks.push({
    check: 'project.godot exists',
    pass: exists,
    detail: exists ? `Project: ${config.config.name}` : 'project.godot not found or empty',
  });

  // Check main_scene set
  const hasMainScene = config.run.main_scene !== '';
  checks.push({
    check: 'main_scene set',
    pass: hasMainScene,
    detail: hasMainScene ? config.run.main_scene : 'No main_scene configured',
  });

  // Check autoloads present
  const hasAutoloads = config.autoloads.length > 0;
  checks.push({
    check: 'autoloads present',
    pass: hasAutoloads,
    detail: hasAutoloads ? `${config.autoloads.length} autoload(s)` : 'No autoloads defined',
  });

  return {
    project_id: projectId,
    project_godot_exists: exists,
    config,
    checks,
    pass: checks.every(c => c.pass),
  };
}

export function registerInspectProject(server: McpServer, db: Database.Database): void {
  server.tool(
    'inspect_project',
    'Parse project.godot and return structured project truth (config, autoloads, display, rendering)',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = inspectProject(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
