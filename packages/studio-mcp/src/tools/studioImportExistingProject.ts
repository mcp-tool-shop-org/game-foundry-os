import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDb } from '../server.js';
import { upsertProject } from '@mcptoolshop/game-foundry-registry';
import { runDiagnostics, createBootstrap, completeBootstrap, classifyProject, generateAdoptionPlan, partitionFindings } from '@mcptoolshop/studio-bootstrap-core';
import fs from 'node:fs';
import path from 'node:path';

export function registerStudioImportExistingProject(server: McpServer): void {
  server.tool(
    'studio_import_existing_project',
    'Scan an existing project directory and report what bootstrap components are present or missing',
    {
      project_id: z.string().describe('Project ID to register'),
      display_name: z.string().describe('Project display name'),
      root_path: z.string().describe('Absolute path to existing project root'),
    },
    async (params) => {
      const db = getDb();

      // Register project
      upsertProject(db, params.project_id, params.display_name, params.root_path);

      // Create import bootstrap
      const bootstrap = createBootstrap(db, params.project_id, null, 'import_existing', params.root_path);

      // Scan what exists
      const scan: Record<string, boolean> = {};
      const gdFiles = ['project.godot', 'battle/scenes/battle_scene.gd', 'battle/scenes/combat_hud.gd'];
      for (const f of gdFiles) {
        scan[f] = fs.existsSync(path.join(params.root_path, f));
      }
      scan['canon_vault'] = fs.existsSync(path.join(params.root_path, 'canon'));
      scan['assets_sprites'] = fs.existsSync(path.join(params.root_path, 'assets', 'sprites'));
      scan['assets_portraits'] = fs.existsSync(path.join(params.root_path, 'assets', 'portraits'));

      const diag = runDiagnostics(db, params.project_id, params.root_path);

      const foundCount = Object.values(scan).filter(v => v).length;
      const result = foundCount === Object.keys(scan).length ? 'pass' : 'partial';
      completeBootstrap(db, bootstrap.id, result, JSON.stringify({ scan, diagnostics: diag }));

      // Adoption classification and staged plan
      const profile = classifyProject(scan, diag);
      const adoptionPlan = generateAdoptionPlan(db, params.project_id, profile, diag.findings);
      const partitioned = partitionFindings(diag.findings);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            project_id: params.project_id,
            scan,
            diagnostics: diag,
            bootstrap_result: result,
            adoption_profile: profile,
            adoption_plan: adoptionPlan,
            finding_partitions: partitioned,
          }, null, 2),
        }],
      };
    },
  );
}
