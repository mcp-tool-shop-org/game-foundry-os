import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import path from 'node:path';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseScene } from '../utils/godot-scene.js';

export interface SignalIssue {
  signal: string;
  from: string;
  to: string;
  method: string;
  issue: string;
}

export interface SignalContractAuditResult {
  project_id: string;
  scene_path: string;
  connections: Array<{ signal: string; from: string; to: string; method: string }>;
  issues: SignalIssue[];
  pass: boolean;
}

export function signalContractAudit(
  db: Database.Database,
  projectId: string,
  scenePath: string,
): SignalContractAuditResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const absPath = path.join(project.root_path, scenePath);
  const scene = parseScene(absPath);
  const issues: SignalIssue[] = [];

  // Build set of node names from the scene tree
  const nodeNames = new Set(scene.nodes.map(n => n.name));
  // Root node (first node, no parent) is "."
  if (scene.nodes.length > 0) {
    nodeNames.add('.');
  }

  // Also build path-accessible names (parent/child notation)
  const nodePaths = new Set<string>();
  for (const node of scene.nodes) {
    if (!node.parent) {
      nodePaths.add('.');
    } else if (node.parent === '.') {
      nodePaths.add(node.name);
    } else {
      nodePaths.add(`${node.parent}/${node.name}`);
    }
  }

  for (const conn of scene.connections) {
    // Check if 'from' node exists (by name or path)
    const fromExists = nodeNames.has(conn.from) || nodePaths.has(conn.from);
    if (!fromExists) {
      issues.push({
        signal: conn.signal,
        from: conn.from,
        to: conn.to,
        method: conn.method,
        issue: `Source node "${conn.from}" not found in scene tree`,
      });
    }

    // Check if 'to' node exists
    const toExists = nodeNames.has(conn.to) || nodePaths.has(conn.to);
    if (!toExists) {
      issues.push({
        signal: conn.signal,
        from: conn.from,
        to: conn.to,
        method: conn.method,
        issue: `Target node "${conn.to}" not found in scene tree`,
      });
    }

    // Check method name is valid identifier
    if (conn.method && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(conn.method)) {
      issues.push({
        signal: conn.signal,
        from: conn.from,
        to: conn.to,
        method: conn.method,
        issue: `Method name "${conn.method}" is not a valid identifier`,
      });
    }
  }

  const connections = scene.connections.map(c => ({
    signal: c.signal,
    from: c.from,
    to: c.to,
    method: c.method,
  }));

  return {
    project_id: projectId,
    scene_path: scenePath,
    connections,
    issues,
    pass: issues.length === 0,
  };
}

export function registerSignalContractAudit(server: McpServer, db: Database.Database): void {
  server.tool(
    'signal_contract_audit',
    'Parse .tscn connection entries, check target nodes exist in scene tree and method names are valid',
    {
      project_id: z.string(),
      scene_path: z.string().describe('Scene path relative to project root'),
    },
    async ({ project_id, scene_path }) => {
      try {
        const result = signalContractAudit(db, project_id, scene_path);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
