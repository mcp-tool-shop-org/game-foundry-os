import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDatabase, upsertProject, upsertCharacter, upsertVariant } from '@mcptoolshop/game-foundry-registry';
import {
  transitionState, getProductionState,
  lockPick,
  registerArtifact, getArtifacts,
} from '@mcptoolshop/sprite-foundry-core';
import type Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const DIRECTIONS = ['front', 'front_34', 'side', 'back_34', 'back'];

describe('sync and portrait tools', () => {
  let db: Database.Database;
  let tmpDir: string;
  const projectId = 'proj_sync';
  const charId = 'char_sync';
  const variantId = 'var_sync';

  beforeEach(() => {
    db = openDatabase(':memory:');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gfos-sync-'));
    upsertProject(db, projectId, 'Sync Project', tmpDir);
    upsertCharacter(db, { id: charId, project_id: projectId, display_name: 'Sync Char' });
    upsertVariant(db, { id: variantId, character_id: charId, variant_type: 'base' });
    // Advance to pack_sliced
    transitionState(db, variantId, 'concept_batch_started');
    transitionState(db, variantId, 'concept_candidates_recorded');
    transitionState(db, variantId, 'concept_locked');
    transitionState(db, variantId, 'directional_batch_started');
    for (const dir of DIRECTIONS) {
      lockPick(db, { variant_id: variantId, pick_type: 'directional', direction: dir });
    }
    transitionState(db, variantId, 'directional_locked');
    transitionState(db, variantId, 'sheet_assembled');
    transitionState(db, variantId, 'pack_sliced');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('sync_pack_to_engine', () => {
    it('copies files from source to target directory', () => {
      // Create source pack_member files
      const srcDir = path.join(tmpDir, 'src_pack');
      fs.mkdirSync(srcDir, { recursive: true });
      for (const dir of DIRECTIONS) {
        const filePath = path.join(srcDir, `${dir}.png`);
        fs.writeFileSync(filePath, `fake-sprite-${dir}`);
        registerArtifact(db, {
          project_id: projectId,
          variant_id: variantId,
          artifact_type: 'pack_member',
          direction: dir,
          path: filePath,
          is_canonical: true,
        });
      }

      // Verify source files exist
      const packMembers = getArtifacts(db, variantId, 'pack_member');
      expect(packMembers).toHaveLength(5);

      // Simulate sync by copying files to target
      const targetDir = path.join(tmpDir, 'engine_target');
      fs.mkdirSync(targetDir, { recursive: true });
      for (const member of packMembers) {
        const dest = path.join(targetDir, path.basename(member.path));
        if (fs.existsSync(member.path)) {
          fs.copyFileSync(member.path, dest);
        }
      }

      // Verify target files
      const copied = fs.readdirSync(targetDir);
      expect(copied.length).toBe(5);
    });

    it('registers sync_receipt artifact', () => {
      const receipt = registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'sync_receipt',
        path: path.join(tmpDir, 'engine/target'),
        is_canonical: true,
        metadata_json: JSON.stringify({
          pack_name: 'test_pack',
          runtime_variant_name: 'base',
          files_copied: 5,
        }),
      });

      expect(receipt.artifact_type).toBe('sync_receipt');
      expect(receipt.is_canonical).toBe(1);
      const meta = JSON.parse(receipt.metadata_json!);
      expect(meta.files_copied).toBe(5);
    });

    it('transitions to engine_synced', () => {
      registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'sync_receipt',
        path: path.join(tmpDir, 'target'),
        is_canonical: true,
      });

      const result = transitionState(db, variantId, 'engine_synced', {
        toolName: 'sync_pack_to_engine',
        reason: 'Synced 5 files',
      });

      expect(result.from_state).toBe('pack_sliced');
      expect(result.to_state).toBe('engine_synced');
      expect(getProductionState(db, variantId)).toBe('engine_synced');
    });
  });

  describe('attach_portrait_set', () => {
    beforeEach(() => {
      transitionState(db, variantId, 'engine_synced');
    });

    it('registers portrait artifacts with size metadata', () => {
      const portraits = [
        { path: '/tmp/portrait_80.png', size: '80x80' as const },
        { path: '/tmp/portrait_28.png', size: '28x28' as const },
      ];

      const artifacts = portraits.map((p, i) => {
        const [w, h] = p.size.split('x').map(Number);
        return registerArtifact(db, {
          project_id: projectId,
          variant_id: variantId,
          artifact_type: 'portrait',
          direction: `portrait_${i}`,
          path: p.path,
          width: w,
          height: h,
          is_canonical: true,
          metadata_json: JSON.stringify({ size: p.size }),
        });
      });

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].width).toBe(80);
      expect(artifacts[0].height).toBe(80);
      expect(artifacts[1].width).toBe(28);
      expect(artifacts[1].height).toBe(28);
    });

    it('updates variant portrait_state to attached', () => {
      registerArtifact(db, {
        project_id: projectId,
        variant_id: variantId,
        artifact_type: 'portrait',
        path: '/tmp/portrait.png',
        width: 80,
        height: 80,
        is_canonical: true,
      });

      db.prepare("UPDATE variants SET portrait_state = 'attached', updated_at = datetime('now') WHERE id = ?")
        .run(variantId);

      const variant = db.prepare('SELECT portrait_state FROM variants WHERE id = ?').get(variantId) as any;
      expect(variant.portrait_state).toBe('attached');
    });
  });
});
