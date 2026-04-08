import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { inspectProject } from '../src/tools/inspectProject.js';
import { templateShellVerify } from '../src/tools/templateShellVerify.js';
import { autoloadContract } from '../src/tools/autoloadContract.js';
import { assetImportAudit } from '../src/tools/assetImportAudit.js';

const TFR_ROOT = 'F:/AI/the-fractured-road';
const TFR_EXISTS = fs.existsSync(`${TFR_ROOT}/project.godot`);

let db: Database.Database;

beforeEach(() => {
  db = openDatabase(':memory:');
  if (TFR_EXISTS) {
    upsertProject(db, 'tfr', 'The Fractured Road', TFR_ROOT);
  }
});

afterEach(() => {
  db.close();
});

describe('Godot tools integration with The Fractured Road', () => {
  it.skipIf(!TFR_EXISTS)('inspectProject reads TFR project.godot correctly', () => {
    const result = inspectProject(db, 'tfr');
    expect(result.project_godot_exists).toBe(true);
    expect(result.config.config.name).toBe('The Fractured Road');
    expect(result.config.run.main_scene).toContain('battle_scene');
    expect(result.config.display.width).toBe(1280);
    expect(result.config.display.height).toBe(720);
    expect(result.config.display.stretch_mode).toBe('canvas_items');
  });

  it.skipIf(!TFR_EXISTS)('templateShellVerify identifies TFR shell state', () => {
    const result = templateShellVerify(db, 'tfr');
    // TFR may or may not have all shells — just verify it runs without error
    expect(result.project_id).toBe('tfr');
    expect(result.checks.length).toBeGreaterThan(0);
    expect(typeof result.pass).toBe('boolean');
  });

  it.skipIf(!TFR_EXISTS)('autoloadContract checks TFR autoloads', () => {
    const result = autoloadContract(db, 'tfr');
    expect(result.project_id).toBe('tfr');
    expect(result.autoloads.length).toBeGreaterThanOrEqual(0);
    // Each autoload should have name/path/is_singleton/exists
    for (const al of result.autoloads) {
      expect(al.name).toBeTruthy();
      expect(al.path).toBeTruthy();
      expect(typeof al.is_singleton).toBe('boolean');
      expect(typeof al.exists).toBe('boolean');
    }
  });

  it.skipIf(!TFR_EXISTS)('assetImportAudit scans TFR sprite imports', () => {
    const result = assetImportAudit(db, 'tfr');
    expect(result.project_id).toBe('tfr');
    expect(result.project_settings.stretch_mode).toBe('canvas_items');
    expect(typeof result.overall_pass).toBe('boolean');
    expect(typeof result.audit.files_checked).toBe('number');
  });
});
