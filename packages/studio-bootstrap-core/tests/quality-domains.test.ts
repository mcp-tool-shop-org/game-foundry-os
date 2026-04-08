import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import {
  findingToDomain,
  findingsByDomain,
  computeQualityStates,
  getWeakestDomain,
  persistQualityStates,
  ALL_DOMAINS,
  runDiagnostics,
  installRuntimeShell,
  installProofShell,
  seedVault,
  createBootstrap,
  completeBootstrap,
} from '@mcptoolshop/studio-bootstrap-core';
import type { DiagnosticFinding } from '@mcptoolshop/game-foundry-registry';

let db: Database.Database;
let tmpDir: string;

function seedProject(id = 'proj-qd') {
  upsertProject(db, id, 'Quality Domain Project', tmpDir);
}

function makeFinding(id: string, severity: 'critical' | 'major' | 'minor' = 'critical'): DiagnosticFinding {
  return { id, severity, source_tool: 'test', affected_path: '/test', message: `Finding ${id}`, repairable: false, repair_action: null };
}

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quality-domains-'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('findingToDomain', () => {
  it('maps shell findings to runtime_integrity', () => {
    expect(findingToDomain(makeFinding('shell_battle_scene'))).toBe('runtime_integrity');
  });

  it('maps engine findings to runtime_integrity', () => {
    expect(findingToDomain(makeFinding('engine_project_godot'))).toBe('runtime_integrity');
  });

  it('maps autoload findings to runtime_integrity', () => {
    expect(findingToDomain(makeFinding('autoload_missing_gamestate'))).toBe('runtime_integrity');
  });

  it('maps display findings to visual_integrity', () => {
    expect(findingToDomain(makeFinding('display_not_pixel_friendly'))).toBe('visual_integrity');
  });

  it('maps import findings to visual_integrity', () => {
    expect(findingToDomain(makeFinding('import_sprites_compressed'))).toBe('visual_integrity');
  });

  it('maps canon findings to canon_integrity', () => {
    expect(findingToDomain(makeFinding('canon_vault_missing'))).toBe('canon_integrity');
  });

  it('maps proof findings to playability_integrity', () => {
    expect(findingToDomain(makeFinding('proof_shell_missing'))).toBe('playability_integrity');
  });

  it('maps export findings to shipping_integrity', () => {
    expect(findingToDomain(makeFinding('export_presets_missing'))).toBe('shipping_integrity');
  });

  it('maps encounter findings to encounter_integrity', () => {
    expect(findingToDomain(makeFinding('encounter_missing'))).toBe('encounter_integrity');
  });

  it('defaults unknown findings to runtime_integrity', () => {
    expect(findingToDomain(makeFinding('unknown_xyz'))).toBe('runtime_integrity');
  });
});

describe('findingsByDomain', () => {
  it('groups findings correctly', () => {
    const findings = [
      makeFinding('shell_battle_scene'),
      makeFinding('display_not_pixel_friendly', 'minor'),
      makeFinding('canon_vault_missing'),
      makeFinding('proof_shell_missing'),
    ];

    const grouped = findingsByDomain(findings);
    expect(grouped.runtime_integrity).toHaveLength(1);
    expect(grouped.visual_integrity).toHaveLength(1);
    expect(grouped.canon_integrity).toHaveLength(1);
    expect(grouped.playability_integrity).toHaveLength(1);
    expect(grouped.encounter_integrity).toHaveLength(0);
    expect(grouped.shipping_integrity).toHaveLength(0);
  });

  it('handles empty findings', () => {
    const grouped = findingsByDomain([]);
    for (const domain of ALL_DOMAINS) {
      expect(grouped[domain]).toHaveLength(0);
    }
  });
});

describe('computeQualityStates', () => {
  it('returns one entry per domain', () => {
    seedProject();
    const states = computeQualityStates(db, 'proj-qd', tmpDir);
    expect(states).toHaveLength(ALL_DOMAINS.length);
    const domains = states.map(s => s.domain);
    for (const d of ALL_DOMAINS) {
      expect(domains).toContain(d);
    }
  });

  it('domain with critical finding has blocked status', () => {
    seedProject();
    const states = computeQualityStates(db, 'proj-qd', tmpDir);
    // runtime_integrity should be blocked (missing project.godot and shell files)
    const runtime = states.find(s => s.domain === 'runtime_integrity');
    expect(runtime!.status).toBe('blocked');
    expect(runtime!.blocker_count).toBeGreaterThan(0);
  });

  it('domain with no findings has healthy status', () => {
    seedProject();
    const states = computeQualityStates(db, 'proj-qd', tmpDir);
    // encounter_integrity should be healthy (no encounter findings from diagnostics)
    const encounter = states.find(s => s.domain === 'encounter_integrity');
    expect(encounter!.status).toBe('healthy');
    expect(encounter!.blocker_count).toBe(0);
  });

  it('blocked domain has a next_action', () => {
    seedProject();
    const states = computeQualityStates(db, 'proj-qd', tmpDir);
    const blocked = states.filter(s => s.status === 'blocked');
    for (const state of blocked) {
      expect(state.next_action).toBeTruthy();
    }
  });
});

describe('getWeakestDomain', () => {
  it('returns blocked domain over warning', () => {
    const states = [
      { domain: 'visual_integrity' as const, status: 'warning' as const, blocker_count: 0, warning_count: 1, finding_ids: [], next_action: null },
      { domain: 'runtime_integrity' as const, status: 'blocked' as const, blocker_count: 2, warning_count: 0, finding_ids: [], next_action: 'fix' },
    ];
    const weakest = getWeakestDomain(states);
    expect(weakest!.domain).toBe('runtime_integrity');
  });

  it('returns null for all healthy', () => {
    const states = ALL_DOMAINS.map(d => ({
      domain: d, status: 'healthy' as const, blocker_count: 0, warning_count: 0, finding_ids: [], next_action: null,
    }));
    expect(getWeakestDomain(states)).toBeNull();
  });

  it('returns degraded over warning', () => {
    const states = [
      { domain: 'visual_integrity' as const, status: 'warning' as const, blocker_count: 0, warning_count: 1, finding_ids: [], next_action: null },
      { domain: 'canon_integrity' as const, status: 'degraded' as const, blocker_count: 0, warning_count: 0, finding_ids: [], next_action: null },
    ];
    const weakest = getWeakestDomain(states);
    expect(weakest!.domain).toBe('canon_integrity');
  });
});

describe('persistQualityStates', () => {
  it('writes states to DB', () => {
    seedProject();
    const states = computeQualityStates(db, 'proj-qd', tmpDir);
    persistQualityStates(db, 'proj-qd', states);

    const rows = db.prepare('SELECT * FROM quality_domain_states WHERE project_id = ?').all('proj-qd') as any[];
    expect(rows.length).toBe(ALL_DOMAINS.length);
  });

  it('overwrites previous snapshot', () => {
    seedProject();
    const states = computeQualityStates(db, 'proj-qd', tmpDir);
    persistQualityStates(db, 'proj-qd', states);
    persistQualityStates(db, 'proj-qd', states);

    const rows = db.prepare('SELECT * FROM quality_domain_states WHERE project_id = ?').all('proj-qd') as any[];
    expect(rows.length).toBe(ALL_DOMAINS.length); // not doubled
  });
});

describe('diagnostics integration', () => {
  it('every finding from runDiagnostics maps to a domain', () => {
    seedProject();
    const diag = runDiagnostics(db, 'proj-qd', tmpDir);
    for (const finding of diag.findings) {
      const domain = findingToDomain(finding);
      expect(ALL_DOMAINS).toContain(domain);
    }
  });
});
