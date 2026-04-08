import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import path from 'node:path';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseScene, type ParsedScene } from '../utils/godot-scene.js';

export interface SceneGraphResult {
  project_id: string;
  scene_path: string;
  scene: ParsedScene;
}

export function sceneGraph(db: Database.Database, projectId: string, scenePath: string): SceneGraphResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const absPath = path.join(project.root_path, scenePath);
  const scene = parseScene(absPath);

  return {
    project_id: projectId,
    scene_path: scenePath,
    scene,
  };
}

export function registerSceneGraph(server: McpServer, db: Database.Database): void {
  server.tool(
    'scene_graph',
    'Parse a .tscn scene file and return node tree, resources, and signal connections',
    {
      project_id: z.string(),
      scene_path: z.string().describe('Scene path relative to project root (e.g. battle/scenes/battle_scene.tscn)'),
    },
    async ({ project_id, scene_path }) => {
      try {
        const result = sceneGraph(db, project_id, scene_path);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
