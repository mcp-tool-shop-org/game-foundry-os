import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  openDatabase,
  upsertProject,
  upsertCharacter,
  upsertVariant,
} from '@mcptoolshop/game-foundry-registry';
import { createProofRun, addAssertion, getAssertions } from '@mcptoolshop/proof-lab-core';

let db: Database.Database;

function seedProject() {
  upsertProject(db, 'test', 'Test Project', '/tmp/test');
}

function seedVariant(
  charId: string,
  varId: string,
  chapter: string,
  opts?: { packPresent?: number; dirsPresent?: number; portraitState?: string },
) {
  upsertCharacter(db, { id: charId, project_id: 'test', display_name: `Char ${charId}` });
  db.prepare('UPDATE characters SET chapter_primary = ? WHERE id = ?').run(chapter, charId);
  upsertVariant(db, { id: varId, character_id: charId, variant_type: 'base' });

  const sets: string[] = [];
  if (opts?.packPresent !== undefined) sets.push(`pack_present = ${opts.packPresent}`);
  if (opts?.dirsPresent !== undefined) sets.push(`directions_present = ${opts.dirsPresent}`);
  if (opts?.portraitState) sets.push(`portrait_state = '${opts.portraitState}'`);
  if (sets.length > 0) {
    db.prepare(`UPDATE variants SET ${sets.join(', ')} WHERE id = ?`).run(varId);
  }
}

/**
 * Presentation suite is implemented in proof-lab-mcp (proofRunPresentationSuite.ts).
 * We replicate its logic here directly against the DB for core-level tests.
 */
function runPresentationSuite(projectId: string, scopeType: string, scopeId: string) {
  const assertions: Array<{ key: string; status: 'pass' | 'fail' | 'warn'; message: string }> = [];

  let variants: Array<{ id: string; portrait_state: string; pack_present: number; directions_present: number }>;
  if (scopeType === 'variant') {
    const v = db.prepare('SELECT * FROM variants WHERE id = ?').get(scopeId) as any;
    variants = v ? [v] : [];
  } else {
    variants = db.prepare(`
      SELECT v.* FROM variants v
      JOIN characters c ON v.character_id = c.id
      WHERE c.project_id = ? AND c.chapter_primary = ?
    `).all(projectId, scopeId) as any[];
  }

  for (const v of variants) {
    if (v.portrait_state === 'complete') {
      assertions.push({ key: `${v.id}_portrait`, status: 'pass', message: `${v.id}: portraits complete` });
    } else if (v.portrait_state === 'attached') {
      assertions.push({ key: `${v.id}_portrait`, status: 'warn', message: `${v.id}: portraits attached but not complete` });
    } else {
      assertions.push({ key: `${v.id}_portrait`, status: 'warn', message: `${v.id}: portrait state is ${v.portrait_state}` });
    }

    if (v.pack_present === 1 && v.directions_present >= 8) {
      assertions.push({ key: `${v.id}_not_placeholder`, status: 'pass', message: `${v.id}: not a placeholder` });
    } else {
      assertions.push({ key: `${v.id}_not_placeholder`, status: 'fail', message: `${v.id}: placeholder` });
    }
  }

  const failures = assertions.filter(a => a.status === 'fail');
  const warnings = assertions.filter(a => a.status === 'warn');
  const result = failures.length > 0 ? 'fail' as const : 'pass' as const;

  const suiteId = `suite_presentation_${scopeType}`;
  db.prepare(`
    INSERT OR IGNORE INTO proof_suites (id, project_id, suite_key, scope_type, display_name, is_blocking)
    VALUES (?, ?, 'presentation', ?, 'Presentation Proof', 0)
  `).run(suiteId, projectId, scopeType);

  const run = createProofRun(db, {
    project_id: projectId,
    suite_id: suiteId,
    scope_type: scopeType,
    scope_id: scopeId,
    result,
    blocking_failures: failures.length,
    warning_count: warnings.length,
    summary: `Presentation suite: ${result}`,
    tool_name: 'proof_run_presentation_suite',
  });

  for (const a of assertions) {
    addAssertion(db, run.id, a.key, a.status, a.message);
  }

  return { run, passed: result === 'pass', assertions };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedProject();
});

describe('presentation proof suite', () => {
  it('passes when all party members have portraits', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, portraitState: 'complete' });
    const result = runPresentationSuite('test', 'variant', 'v1');
    expect(result.passed).toBe(true);
    expect(result.assertions.some(a => a.key === 'v1_portrait' && a.status === 'pass')).toBe(true);
  });

  it('fails when party member portraits are missing', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 0, dirsPresent: 4, portraitState: 'none' });
    const result = runPresentationSuite('test', 'variant', 'v1');
    expect(result.passed).toBe(false);
    expect(result.assertions.some(a => a.key === 'v1_not_placeholder' && a.status === 'fail')).toBe(true);
  });

  it('reports placeholder absence as a check', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, portraitState: 'attached' });
    const result = runPresentationSuite('test', 'variant', 'v1');
    // portrait_state=attached is a warn, but pack is complete so not_placeholder passes
    expect(result.passed).toBe(true);
    expect(result.assertions.some(a => a.key === 'v1_portrait' && a.status === 'warn')).toBe(true);
    expect(result.assertions.some(a => a.key === 'v1_not_placeholder' && a.status === 'pass')).toBe(true);
  });

  it('warning-only debt does not cause fail when policy allows', () => {
    seedVariant('c1', 'v1', 'ch1', { packPresent: 1, dirsPresent: 8, portraitState: 'none' });
    const result = runPresentationSuite('test', 'variant', 'v1');
    // portrait_state=none is warn (not fail), pack is present with 8 dirs so not_placeholder passes
    // Result should be pass since only warnings, no failures
    expect(result.passed).toBe(true);
    expect(result.run.warning_count).toBeGreaterThan(0);
    expect(result.run.blocking_failures).toBe(0);
  });
});
