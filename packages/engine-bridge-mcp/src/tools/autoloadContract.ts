import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseProjectGodot } from '../utils/godot-project.js';

export interface AutoloadEntry {
  name: string;
  path: string;
  is_singleton: boolean;
  exists: boolean;
}

export interface AutoloadContractResult {
  project_id: string;
  autoloads: AutoloadEntry[];
  missing: string[];
  pass: boolean;
}

/** Convert res://path to absolute filesystem path */
function resPathToAbsolute(projectRoot: string, resPath: string): string {
  const relative = resPath.replace(/^res:\/\//, '');
  return path.join(projectRoot, relative);
}

export function autoloadContract(db: Database.Database, projectId: string): AutoloadContractResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const root = project.root_path;
  const config = parseProjectGodot(root);
  const autoloads: AutoloadEntry[] = [];
  const missing: string[] = [];

  for (const al of config.autoloads) {
    const absPath = resPathToAbsolute(root, al.path);
    const exists = fs.existsSync(absPath);
    autoloads.push({
      name: al.name,
      path: al.path,
      is_singleton: al.is_singleton,
      exists,
    });
    if (!exists) {
      missing.push(`${al.name} (${al.path})`);
    }
  }

  return {
    project_id: projectId,
    autoloads,
    missing,
    pass: missing.length === 0,
  };
}

export function registerAutoloadContract(server: McpServer, db: Database.Database): void {
  server.tool(
    'autoload_contract',
    'Read autoloads from project.godot, check each path exists on disk, verify singleton flags',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = autoloadContract(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
