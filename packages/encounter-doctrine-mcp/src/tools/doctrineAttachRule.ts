import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { attachRule, canEncounterTransition, transitionEncounterState, getEncounterProductionState } from '@mcptoolshop/encounter-doctrine-core';
import { getDb } from '../server.js';

export function registerDoctrineAttachRule(server: McpServer): void {
  server.tool(
    'doctrine_attach_rule',
    'Attach a rule to an encounter (phase_transition, reinforcement, win_condition, etc.). Can advance state to rules_defined.',
    {
      encounter_id: z.string().describe('Encounter ID'),
      rule_type: z.string().describe('Rule type (phase_transition, reinforcement, win_condition, loss_condition, special)'),
      rule_key: z.string().describe('Rule key identifier'),
      rule_payload_json: z.string().optional().describe('Rule payload as JSON string'),
    },
    async (params) => {
      const db = getDb();

      const rule = attachRule(db, {
        encounter_id: params.encounter_id,
        rule_type: params.rule_type,
        rule_key: params.rule_key,
        rule_payload_json: params.rule_payload_json,
      });

      // Try to advance to rules_defined if in formation_defined
      let transition = null;
      const currentState = getEncounterProductionState(db, params.encounter_id);
      if (canEncounterTransition(currentState, 'rules_defined')) {
        transition = transitionEncounterState(db, params.encounter_id, 'rules_defined', {
          reason: 'Rule attached',
          toolName: 'doctrine_attach_rule',
        });
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify({ rule, transition }) }] };
    }
  );
}
