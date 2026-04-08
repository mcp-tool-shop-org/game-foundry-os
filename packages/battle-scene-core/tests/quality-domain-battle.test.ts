import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import type { DiagnosticFinding } from '@mcptoolshop/game-foundry-registry';
import {
  findingToDomain,
  findingsByDomain,
  ALL_DOMAINS,
  getWeakestDomain,
} from '@mcptoolshop/studio-bootstrap-core';

let db: Database.Database;

function makeFinding(id: string, severity: 'critical' | 'major' | 'minor' = 'major'): DiagnosticFinding {
  return { id, severity, source_tool: 'test', affected_path: '/test', message: `Finding ${id}`, repairable: false, repair_action: null };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  upsertProject(db, 'proj-qdb', 'QD Battle', '/tmp/qdb');
});

afterEach(() => {
  db.close();
});

describe('presentation_integrity quality domain', () => {
  it('presentation_integrity is in ALL_DOMAINS', () => {
    expect(ALL_DOMAINS).toContain('presentation_integrity');
  });

  it('ALL_DOMAINS has 7 domains now', () => {
    expect(ALL_DOMAINS).toHaveLength(7);
  });

  it('battle_ prefix findings map to presentation_integrity', () => {
    expect(findingToDomain(makeFinding('battle_no_scene_contract'))).toBe('presentation_integrity');
    expect(findingToDomain(makeFinding('battle_board_exceeds_viewport'))).toBe('presentation_integrity');
    expect(findingToDomain(makeFinding('battle_playtest_failures'))).toBe('presentation_integrity');
    expect(findingToDomain(makeFinding('battle_missing_snapshots'))).toBe('presentation_integrity');
  });

  it('presentation_integrity is between encounter and canon in priority', () => {
    const encIdx = ALL_DOMAINS.indexOf('encounter_integrity');
    const presIdx = ALL_DOMAINS.indexOf('presentation_integrity');
    const canonIdx = ALL_DOMAINS.indexOf('canon_integrity');

    expect(presIdx).toBeGreaterThan(encIdx);
    expect(presIdx).toBeLessThan(canonIdx);
  });

  it('findingsByDomain groups battle_ findings into presentation_integrity', () => {
    const findings = [
      makeFinding('battle_no_scene_contract'),
      makeFinding('shell_battle_scene', 'critical'),
      makeFinding('canon_vault_missing', 'critical'),
    ];
    const grouped = findingsByDomain(findings);

    expect(grouped.presentation_integrity).toHaveLength(1);
    expect(grouped.presentation_integrity[0].id).toBe('battle_no_scene_contract');
    expect(grouped.runtime_integrity).toHaveLength(1); // shell_
    expect(grouped.canon_integrity).toHaveLength(1); // canon_
  });

  it('getWeakestDomain returns presentation_integrity when it is blocked', () => {
    const states = [
      { domain: 'runtime_integrity' as const, status: 'healthy' as const, blocker_count: 0, warning_count: 0, finding_ids: [], next_action: null },
      { domain: 'presentation_integrity' as const, status: 'blocked' as const, blocker_count: 1, warning_count: 0, finding_ids: ['battle_bad'], next_action: 'fix' },
      { domain: 'canon_integrity' as const, status: 'warning' as const, blocker_count: 0, warning_count: 1, finding_ids: [], next_action: null },
    ];
    const weakest = getWeakestDomain(states);
    expect(weakest!.domain).toBe('presentation_integrity');
  });

  it('presentation_integrity finding does not route to encounter_integrity', () => {
    const domain = findingToDomain(makeFinding('battle_layer_data_incomplete_intent'));
    expect(domain).toBe('presentation_integrity');
    expect(domain).not.toBe('encounter_integrity');
  });
});
