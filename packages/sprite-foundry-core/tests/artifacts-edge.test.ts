import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  registerArtifact, getCanonicalArtifact, computeFileHash,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('artifact edge cases', () => {
  let db: Database.Database;
  const projectId = 'proj_art';
  const charId = 'char_art';
  const variantId = 'var_art';

  beforeEach(() => {
    db = openDatabase(':memory:');
    upsertProject(db, projectId, 'Artifact Project', '/tmp/art');
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Art Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
  });

  it('registers artifact with is_canonical=false', () => {
    const artifact = registerArtifact(db, {
      project_id: projectId,
      variant_id: variantId,
      artifact_type: 'concept_candidate',
      path: '/tmp/candidate.png',
      is_canonical: false,
    });

    expect(artifact.is_canonical).toBe(0);
    expect(artifact.artifact_type).toBe('concept_candidate');
  });

  it('getCanonicalArtifact ignores non-canonical artifacts', () => {
    // Register non-canonical
    registerArtifact(db, {
      project_id: projectId,
      variant_id: variantId,
      artifact_type: 'concept_candidate',
      path: '/tmp/non_canonical.png',
      is_canonical: false,
    });

    // No canonical artifact exists
    const canonical = getCanonicalArtifact(db, variantId, 'concept_candidate');
    expect(canonical).toBeUndefined();

    // Register a canonical one (use different direction to avoid ID collision)
    registerArtifact(db, {
      project_id: projectId,
      variant_id: variantId,
      artifact_type: 'concept_candidate',
      direction: 'canonical',
      path: '/tmp/canonical.png',
      is_canonical: true,
    });

    const found = getCanonicalArtifact(db, variantId, 'concept_candidate');
    expect(found).toBeDefined();
    expect(found!.path).toBe('/tmp/canonical.png');
    expect(found!.is_canonical).toBe(1);
  });

  it('getCanonicalArtifact with direction filter returns correct artifact', () => {
    registerArtifact(db, {
      project_id: projectId,
      variant_id: variantId,
      artifact_type: 'directional_locked',
      direction: 'front',
      path: '/tmp/front.png',
      is_canonical: true,
    });
    registerArtifact(db, {
      project_id: projectId,
      variant_id: variantId,
      artifact_type: 'directional_locked',
      direction: 'back',
      path: '/tmp/back.png',
      is_canonical: true,
    });

    const front = getCanonicalArtifact(db, variantId, 'directional_locked', 'front');
    expect(front).toBeDefined();
    expect(front!.direction).toBe('front');
    expect(front!.path).toBe('/tmp/front.png');

    const back = getCanonicalArtifact(db, variantId, 'directional_locked', 'back');
    expect(back).toBeDefined();
    expect(back!.direction).toBe('back');

    const side = getCanonicalArtifact(db, variantId, 'directional_locked', 'side');
    expect(side).toBeUndefined();
  });

  describe('computeFileHash', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-hash-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns consistent hash for same content', () => {
      const filePath = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(filePath, 'hello world');

      const hash1 = computeFileHash(filePath);
      const hash2 = computeFileHash(filePath);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);

      // Different content → different hash
      const filePath2 = path.join(tmpDir, 'test2.txt');
      fs.writeFileSync(filePath2, 'different content');
      const hash3 = computeFileHash(filePath2);
      expect(hash3).not.toBe(hash1);

      // Nonexistent file → null
      const hash4 = computeFileHash(path.join(tmpDir, 'nonexistent.txt'));
      expect(hash4).toBeNull();
    });
  });
});
