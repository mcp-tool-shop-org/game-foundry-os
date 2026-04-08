import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exportManifest, canEncounterTransition, transitionEncounterState, getEncounterProductionState } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineExportManifest(server: McpServer): void {
  server.tool(
    'doctrine_export_manifest',
    'Export encounter manifest JSON. Transitions to manifest_exported.',
    {
      encounter_id: z.string().describe('Encounter ID'),
      project_root: z.string().describe('Project root path'),
      target_path: z.string().describe('Target path relative to project root'),
      format_version: z.string().optional().describe('Format version (default 1.0)'),
    },
    async (params) => {
      const db = getDb();

      const result = exportManifest(
        db,
        params.encounter_id,
        params.project_root,
        params.target_path,
        params.format_version,
      );

      let transition = null;
      const currentState = getEncounterProductionState(db, params.encounter_id);
      if (canEncounterTransition(currentState, 'manifest_exported')) {
        transition = transitionEncounterState(db, params.encounter_id, 'manifest_exported', {
          reason: 'Manifest exported',
          toolName: 'doctrine_export_manifest',
        });
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ ...result, transition }) }] };
    }
  );
}
