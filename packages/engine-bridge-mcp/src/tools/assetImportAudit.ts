import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { auditImportSettings, type ImportAuditResult } from '../utils/godot-import.js';
import { parseProjectGodot } from '../utils/godot-project.js';

export interface AssetImportAuditResult {
  project_id: string;
  audit: ImportAuditResult;
  project_settings: {
    stretch_mode: string;
    scale_mode: string;
    renderer: string;
  };
  overall_pass: boolean;
}

export function assetImportAudit(
  db: Database.Database,
  projectId: string,
  assetDir?: string,
): AssetImportAuditResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const audit = auditImportSettings(project.root_path, assetDir);
  const config = parseProjectGodot(project.root_path);

  // Additional project-level pixel art checks
  const isIntegerScaling = config.display.scale_mode === 'integer';
  if (!isIntegerScaling && config.display.scale_mode !== '') {
    audit.issues.push({
      file: 'project.godot',
      issue: `scale_mode is "${config.display.scale_mode}", expected "integer" for pixel art`,
      severity: 'warning',
    });
  }

  return {
    project_id: projectId,
    audit,
    project_settings: {
      stretch_mode: config.display.stretch_mode,
      scale_mode: config.display.scale_mode,
      renderer: config.rendering.renderer,
    },
    overall_pass: audit.pass,
  };
}

export function registerAssetImportAudit(server: McpServer, db: Database.Database): void {
  server.tool(
    'asset_import_audit',
    'Audit .import sidecar files for pixel-art compliance (no VRAM compression, no mipmaps, Lossless default)',
    {
      project_id: z.string(),
      asset_dir: z.string().optional().describe('Asset subdirectory to scan, defaults to "assets/"'),
    },
    async ({ project_id, asset_dir }) => {
      try {
        const result = assetImportAudit(db, project_id, asset_dir);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
