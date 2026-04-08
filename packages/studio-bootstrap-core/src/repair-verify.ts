import type Database from 'better-sqlite3';
import type {
  RepairVerificationResult,
  RepairReceiptRow,
  RepairPlanRow,
  ProjectHealthStatus,
} from '@mcptoolshop/game-foundry-registry';
import { runDiagnostics } from './diagnostics.js';
import { getProjectStatus } from './project-status.js';
import crypto from 'node:crypto';

/**
 * Verify whether a repair actually closed the targeted findings.
 * Compares before/after diagnostic state, detects regressions,
 * and updates plan status accordingly.
 */
export function verifyRepairClosure(
  db: Database.Database,
  projectId: string,
  receiptId: string,
  projectRoot: string,
): RepairVerificationResult {
  // 1. Load receipt and plan
  const receipt = db.prepare('SELECT * FROM repair_receipts WHERE id = ?').get(receiptId) as RepairReceiptRow | undefined;
  if (!receipt) throw new Error(`Repair receipt not found: ${receiptId}`);

  const plan = db.prepare('SELECT * FROM repair_plans WHERE id = ?').get(receipt.plan_id) as RepairPlanRow | undefined;
  if (!plan) throw new Error(`Repair plan not found: ${receipt.plan_id}`);

  // 2. Extract before-state from receipt
  const beforeJson = receipt.before_json ? JSON.parse(receipt.before_json) : {};
  const findingsBefore: string[] = plan.finding_ids_json ? JSON.parse(plan.finding_ids_json) : [];

  // 3. Run current diagnostics
  const diagNow = runDiagnostics(db, projectId, projectRoot);
  const findingsNow = diagNow.findings.map(f => f.id);
  const findingsNowSet = new Set(findingsNow);

  // 4. Compute closure
  const findingsCleared = findingsBefore.filter((id: string) => !findingsNowSet.has(id));
  const findingsNew = findingsNow.filter(id => !findingsBefore.includes(id));

  // 5. Get status transition
  const statusNow = getProjectStatus(db, projectId);
  const statusBefore = beforeJson.status as ProjectHealthStatus | undefined;
  const statusTransition = statusBefore && statusBefore !== statusNow.status
    ? { from: statusBefore, to: statusNow.status }
    : null;

  // 6. Detect regressions
  const regressionsDetected = findingsNew.length > 0;

  // 7. Determine if closed
  const closed = findingsCleared.length > 0 && !regressionsDetected;

  // 8. Update plan status
  if (closed) {
    db.prepare("UPDATE repair_plans SET status = 'closed' WHERE id = ?").run(plan.id);
  } else if (regressionsDetected) {
    db.prepare("UPDATE repair_plans SET status = 'escalated' WHERE id = ?").run(plan.id);
  }

  // 9. Update receipt verification
  const verificationJson = JSON.stringify({
    ran: true,
    passed: !regressionsDetected,
    findings_cleared: findingsCleared,
    new_findings: findingsNew,
  });
  db.prepare('UPDATE repair_receipts SET verification_json = ? WHERE id = ?').run(verificationJson, receiptId);

  return {
    receipt_id: receiptId,
    plan_id: plan.id,
    action_key: plan.action_key,
    findings_before: findingsBefore,
    findings_after: findingsNow,
    findings_cleared: findingsCleared,
    findings_new: findingsNew,
    regressions_detected: regressionsDetected,
    status_transition: statusTransition,
    closed,
  };
}
