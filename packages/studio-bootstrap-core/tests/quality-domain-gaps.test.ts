import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import type { DiagnosticFinding } from '@mcptoolshop/game-foundry-registry';
import {
  findingToDomain,
  computeQualityStates,
  getWeakestDomain,
  persistQualityStates,
  ALL_DOMAINS,
  runDiagnostics,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;
let tmpDir: string;

function makeFinding(id: string, severity: 'critical' | 'major' | 'minor' = 'critical', repairAction: string | null = null): DiagnosticFinding {
  return { id, severity, source_tool: 'test', affected_path: '/test', message: `Finding ${id}`, repairable: !!repairAction, repair_action: repairAction };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-domain-gaps-'));
  upsertProject(db, 'proj-qdg', 'Quality Domain Gaps', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('quality domain gaps', () => {
  it('visual-integrity blocker outranks lower administrative defects', () => {
    const states = [
      { domain: 'visual_integrity' as const, status: 'blocked' as const, blocker_count: 1, warning_count: 0, finding_ids: ['display_bad'], next_action: 'fix_display' },
      { domain: 'shipping_integrity' as const, status: 'warning' as const, blocker_count: 0, warning_count: 1, finding_ids: ['export_minor'], next_action: null },
      { domain: 'canon_integrity' as const, status: 'degraded' as const, blocker_count: 0, warning_count: 0, finding_ids: ['canon_issue'], next_action: null },
    ];

    const weakest = getWeakestDomain(states);
    expect(weakest).not.toBeNull();
    expect(weakest!.status).toBe('blocked');
    expect(weakest!.domain).toBe('visual_integrity');
  });

  it('proof/playability blocker outranks advisory warnings', () => {
    const states = [
      { domain: 'playability_integrity' as const, status: 'blocked' as const, blocker_count: 1, warning_count: 0, finding_ids: ['proof_missing'], next_action: 'install_proof' },
      { domain: 'runtime_integrity' as const, status: 'warning' as const, blocker_count: 0, warning_count: 2, finding_ids: ['minor1', 'minor2'], next_action: null },
      { domain: 'shipping_integrity' as const, status: 'warning' as const, blocker_count: 0, warning_count: 1, finding_ids: ['export_minor'], next_action: null },
    ];

    const weakest = getWeakestDomain(states);
    expect(weakest!.domain).toBe('playability_integrity');
    expect(weakest!.status).toBe('blocked');
  });

  it('domain summaries include operational next-action per blocked domain', () => {
    // Compute states from a project with multiple blocked domains
    const states = computeQualityStates(db, 'proj-qdg', tmpDir);

    // Every blocked domain should have a next_action
    const blocked = states.filter(s => s.status === 'blocked');
    expect(blocked.length).toBeGreaterThan(0);
    for (const state of blocked) {
      expect(state.next_action).toBeTruthy();
      expect(typeof state.next_action).toBe('string');
    }

    // Each domain has expected fields
    for (const state of states) {
      expect(ALL_DOMAINS).toContain(state.domain);
      expect(typeof state.blocker_count).toBe('number');
      expect(typeof state.warning_count).toBe('number');
      expect(Array.isArray(state.finding_ids)).toBe(true);
    }
  });

  it('quality state persisted and retrievable via DB query', () => {
    const states = computeQualityStates(db, 'proj-qdg', tmpDir);
    persistQualityStates(db, 'proj-qdg', states);

    // Retrieve from DB and verify shape
    const rows = db.prepare('SELECT * FROM quality_domain_states WHERE project_id = ?').all('proj-qdg') as any[];
    expect(rows.length).toBe(ALL_DOMAINS.length);

    for (const row of rows) {
      expect(row.project_id).toBe('proj-qdg');
      expect(ALL_DOMAINS).toContain(row.domain);
      expect(['healthy', 'warning', 'degraded', 'blocked', 'unknown']).toContain(row.status);
      expect(typeof row.blocker_count).toBe('number');
      expect(typeof row.warning_count).toBe('number');
      expect(row.computed_at).toBeTruthy();

      // finding_ids_json should be parseable
      if (row.finding_ids_json) {
        const ids = JSON.parse(row.finding_ids_json);
        expect(Array.isArray(ids)).toBe(true);
      }
    }
  });
});
