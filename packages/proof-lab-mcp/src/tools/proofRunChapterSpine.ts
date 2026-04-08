import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runAssetSuite, runEncounterSuite, runRuntimeSuite, createProofRun, addAssertion } from '@mcptoolshop/proof-lab-core';
import { getDb } from '../server.js';

export function registerProofRunChapterSpine(server: McpServer): void {
  server.tool(
    'proof_run_chapter_spine',
    'Run all proof suites (asset + encounter + runtime) for a chapter, aggregated into one chapter proof run',
    {
      project_id: z.string().describe('Project ID'),
      chapter_id: z.string().describe('Chapter ID'),
      project_root: z.string().describe('Absolute path to project root'),
    },
    async (params) => {
      const db = getDb();

      const assetResult = runAssetSuite(db, params.project_id, 'chapter', params.chapter_id);
      const encounterResult = runEncounterSuite(db, params.project_id, 'chapter', params.chapter_id);
      const runtimeResult = runRuntimeSuite(db, params.project_id, 'chapter', params.chapter_id, params.project_root);

      const allPassed = assetResult.passed && encounterResult.passed && runtimeResult.passed;
      const totalFailures = assetResult.run.blocking_failures + encounterResult.run.blocking_failures + runtimeResult.run.blocking_failures;
      const totalWarnings = assetResult.run.warning_count + encounterResult.run.warning_count + runtimeResult.run.warning_count;

      // Create aggregate chapter spine run
      const run = createProofRun(db, {
        project_id: params.project_id,
        scope_type: 'chapter',
        scope_id: params.chapter_id,
        result: allPassed ? 'pass' : 'fail',
        blocking_failures: totalFailures,
        warning_count: totalWarnings,
        summary: `Chapter spine: ${allPassed ? 'PASS' : 'FAIL'} (asset=${assetResult.run.result}, encounter=${encounterResult.run.result}, runtime=${runtimeResult.run.result})`,
        tool_name: 'proof_run_chapter_spine',
      });

      addAssertion(db, run.id, 'asset_suite', assetResult.passed ? 'pass' : 'fail', `Asset: ${assetResult.run.result}`);
      addAssertion(db, run.id, 'encounter_suite', encounterResult.passed ? 'pass' : 'fail', `Encounter: ${encounterResult.run.result}`);
      addAssertion(db, run.id, 'runtime_suite', runtimeResult.passed ? 'pass' : 'fail', `Runtime: ${runtimeResult.run.result}`);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            chapter: params.chapter_id,
            overall: allPassed ? 'pass' : 'fail',
            asset: assetResult.run.result,
            encounter: encounterResult.run.result,
            runtime: runtimeResult.run.result,
            total_failures: totalFailures,
            total_warnings: totalWarnings,
            run_id: run.id,
          }),
        }],
      };
    },
  );
}
