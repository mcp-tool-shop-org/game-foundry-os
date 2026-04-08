import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseScene } from '../utils/godot-scene.js';

export interface UidIssue {
  scene: string;
  resource_id: string;
  uid: string;
  path: string;
  issue: string;
}

export interface ResourceUidAuditResult {
  project_id: string;
  audited: number;
  issues: UidIssue[];
  pass: boolean;
}

/** Recursively find all .tscn files */
function findTscnFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip .godot cache directory
      if (entry.name === '.godot' || entry.name === '.import') continue;
      results.push(...findTscnFiles(full));
    } else if (entry.name.endsWith('.tscn')) {
      results.push(full);
    }
  }
  return results;
}

/** Convert res://path to absolute filesystem path */
function resPathToAbsolute(projectRoot: string, resPath: string): string {
  const relative = resPath.replace(/^res:\/\//, '');
  return path.join(projectRoot, relative);
}

export function resourceUidAudit(db: Database.Database, projectId: string): ResourceUidAuditResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const root = project.root_path;
  const tscnFiles = findTscnFiles(root);
  const issues: UidIssue[] = [];

  for (const tscnPath of tscnFiles) {
    const relScene = path.relative(root, tscnPath);
    const scene = parseScene(tscnPath);

    for (const ext of scene.ext_resources) {
      if (!ext.path) continue;

      // Check if the referenced path exists on disk
      const absPath = resPathToAbsolute(root, ext.path);
      if (!fs.existsSync(absPath)) {
        issues.push({
          scene: relScene,
          resource_id: ext.id,
          uid: ext.uid ?? '',
          path: ext.path,
          issue: 'Referenced file does not exist on disk',
        });
      }
    }
  }

  return {
    project_id: projectId,
    audited: tscnFiles.length,
    issues,
    pass: issues.length === 0,
  };
}

export function registerResourceUidAudit(server: McpServer, db: Database.Database): void {
  server.tool(
    'resource_uid_audit',
    'Scan all .tscn files for ext_resource entries, check if referenced paths exist on disk, report stale UIDs',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = resourceUidAudit(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
