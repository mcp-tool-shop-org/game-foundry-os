import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { getProjectStatus, getTemplate, registerDefaultTemplates } from '@mcptoolshop/studio-bootstrap-core';

export function registerStudioDiffProjectVsTemplate(server: McpServer): void {
  server.tool(
    'studio_diff_project_vs_template',
    'Compare a project against its template baseline — reports missing components and drift',
    {
      project_id: z.string().describe('Project ID'),
      template_key: z.string().default('godot-tactics-template').describe('Template key to diff against'),
    },
    async (params) => {
      const db = getDb();

      registerDefaultTemplates(db);
      const template = getTemplate(db, params.template_key);
      if (!template) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Template not found: ${params.template_key}` }) }],
        };
      }

      const status = getProjectStatus(db, params.project_id);

      const diffs: Array<{ component: string; expected: boolean; actual: boolean; status: string }> = [];

      diffs.push({
        component: 'canon_vault',
        expected: true,
        actual: status.installed_shells.canon,
        status: status.installed_shells.canon ? 'match' : 'missing',
      });

      diffs.push({
        component: 'registry_defaults',
        expected: true,
        actual: status.installed_shells.registry,
        status: status.installed_shells.registry ? 'match' : 'missing',
      });

      diffs.push({
        component: 'runtime_shell',
        expected: true,
        actual: status.installed_shells.runtime,
        status: status.installed_shells.runtime ? 'match' : 'missing',
      });

      diffs.push({
        component: 'proof_shell',
        expected: true,
        actual: status.installed_shells.proof,
        status: status.installed_shells.proof ? 'match' : 'missing',
      });

      const missing = diffs.filter(d => d.status === 'missing');
      const complete = missing.length === 0;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            template_key: params.template_key,
            template_version: template.version,
            status: status.status,
            diffs,
            complete,
            missing_count: missing.length,
            engine_truth: status.engine_truth,
            next_step: status.next_step,
          }, null, 2),
        }],
      };
    },
  );
}
