import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import {
  createBootstrap,
  completeBootstrap,
  seedProjectRegistry,
  seedVault,
  installRuntimeShell,
  installThemeShell,
  installProofShell,
  getTemplate,
  registerDefaultTemplates,
} from '@mcptoolshop/studio-bootstrap-core';
import { upsertProject } from '@mcptoolshop/game-foundry-registry';
import path from 'node:path';

export function registerStudioBootstrapTemplate(server: McpServer): void {
  server.tool(
    'studio_bootstrap_template',
    'Run full bootstrap: registry seed + vault seed + runtime shell + theme shell + proof shell',
    {
      project_id: z.string().describe('Project ID'),
      display_name: z.string().describe('Project display name'),
      root_path: z.string().describe('Absolute path to project root'),
      template_key: z.string().default('godot-tactics-template').describe('Template key to use'),
      bootstrap_mode: z.enum(['blank', 'story_first', 'combat_first', 'import_existing']).default('combat_first'),
      vault_subdir: z.string().default('canon').describe('Subdirectory within root for canon vault'),
    },
    async (params) => {
      const db = getDb();

      // Ensure default templates exist
      registerDefaultTemplates(db);

      // Get template
      const template = getTemplate(db, params.template_key);
      if (!template) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Template not found: ${params.template_key}` }) }],
        };
      }

      // Create project
      upsertProject(db, params.project_id, params.display_name, params.root_path);

      // Create bootstrap record
      const bootstrap = createBootstrap(db, params.project_id, template.id, params.bootstrap_mode, params.root_path);

      const results: Record<string, unknown> = {};

      try {
        // 1. Seed registry
        results.registry = seedProjectRegistry(db, params.project_id, params.template_key);

        // 2. Seed vault
        const vaultPath = path.join(params.root_path, params.vault_subdir);
        results.vault = seedVault(db, params.project_id, vaultPath, params.bootstrap_mode);

        // 3. Install runtime shell
        results.runtime = installRuntimeShell(db, params.project_id, params.root_path);

        // 4. Install theme shell
        results.theme = installThemeShell(db, params.project_id, params.root_path);

        // 5. Install proof shell
        results.proof = installProofShell(db, params.project_id);

        // Complete bootstrap
        completeBootstrap(db, bootstrap.id, 'pass', JSON.stringify(results));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              bootstrap_id: bootstrap.id,
              result: 'pass',
              ...results,
            }, null, 2),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        completeBootstrap(db, bootstrap.id, 'fail', JSON.stringify({ error: message }));
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message, partial_results: results }) }],
        };
      }
    },
  );
}
