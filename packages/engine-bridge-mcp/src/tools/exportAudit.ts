import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { getProject } from '@mcptoolshop/game-foundry-registry';
import { parseIniSections } from '../utils/godot-project.js';

export interface ExportPreset {
  name: string;
  platform: string;
  runnable: boolean;
}

export interface ExportAuditIssue {
  issue: string;
  severity: 'warning' | 'error';
}

export interface ExportAuditResult {
  project_id: string;
  presets: ExportPreset[];
  issues: ExportAuditIssue[];
  pass: boolean;
}

export function exportAudit(db: Database.Database, projectId: string): ExportAuditResult {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const root = project.root_path;
  const cfgPath = path.join(root, 'export_presets.cfg');
  const issues: ExportAuditIssue[] = [];
  const presets: ExportPreset[] = [];

  if (!fs.existsSync(cfgPath)) {
    issues.push({
      issue: 'export_presets.cfg not found',
      severity: 'error',
    });
    return { project_id: projectId, presets, issues, pass: false };
  }

  const content = fs.readFileSync(cfgPath, 'utf-8');
  const sections = parseIniSections(content);

  // Export presets use [preset.0], [preset.1], etc. section names
  // with [preset.0.options] for options
  for (const [sectionName, sectionData] of sections) {
    // Match preset.N (but not preset.N.options)
    if (/^preset\.\d+$/.test(sectionName)) {
      const name = sectionData.get('name');
      const platform = sectionData.get('platform');
      const runnable = sectionData.get('runnable');

      presets.push({
        name: typeof name === 'string' ? name : '',
        platform: typeof platform === 'string' ? platform : '',
        runnable: runnable === true,
      });
    }
  }

  if (presets.length === 0) {
    issues.push({
      issue: 'No export presets defined in export_presets.cfg',
      severity: 'error',
    });
  }

  // Check for unnamed presets
  for (const preset of presets) {
    if (!preset.name) {
      issues.push({
        issue: 'Export preset has empty name',
        severity: 'warning',
      });
    }
  }

  return {
    project_id: projectId,
    presets,
    issues,
    pass: issues.filter(i => i.severity === 'error').length === 0,
  };
}

export function registerExportAudit(server: McpServer, db: Database.Database): void {
  server.tool(
    'export_audit',
    'Check export_presets.cfg exists and has at least one valid preset',
    { project_id: z.string() },
    async ({ project_id }) => {
      try {
        const result = exportAudit(db, project_id);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }], isError: true };
      }
    },
  );
}
