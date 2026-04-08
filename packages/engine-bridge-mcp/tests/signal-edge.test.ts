import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { openDatabase, upsertProject } from '@mcptoolshop/game-foundry-registry';
import { signalContractAudit } from '../src/tools/signalContractAudit.js';

let db: Database.Database;
let tmpDir: string;

beforeEach(() => {
  db = openDatabase(':memory:');
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'signal-edge-'));
  upsertProject(db, 'test-project', 'Test Project', tmpDir);
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const absPath = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

describe('signalContractAudit edge cases', () => {
  it('handles scene with no connections', () => {
    writeFile('no-conn.tscn', `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Child" type="Sprite2D" parent="."]
`);
    const result = signalContractAudit(db, 'test-project', 'no-conn.tscn');
    expect(result.pass).toBe(true);
    expect(result.connections).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it('validates method name format (no special chars)', () => {
    writeFile('bad-method.tscn', `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Btn" type="Button" parent="."]

[connection signal="pressed" from="Btn" to="." method="on-button-pressed!"]
`);
    const result = signalContractAudit(db, 'test-project', 'bad-method.tscn');
    expect(result.pass).toBe(false);
    const methodIssue = result.issues.find(i => i.issue.includes('not a valid identifier'));
    expect(methodIssue).toBeDefined();
  });

  it('handles connection with nested node paths', () => {
    writeFile('nested.tscn', `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="UI" type="Control" parent="."]

[node name="Button" type="Button" parent="UI"]

[connection signal="pressed" from="UI/Button" to="." method="_on_button_pressed"]
`);
    const result = signalContractAudit(db, 'test-project', 'nested.tscn');
    // UI/Button is a path-based reference — from should resolve
    expect(result.connections).toHaveLength(1);
    expect(result.connections[0].from).toBe('UI/Button');
  });

  it('reports multiple issues from same scene', () => {
    writeFile('multi-issue.tscn', `[gd_scene format=3]

[node name="Root" type="Node2D"]

[connection signal="pressed" from="Ghost1" to="." method="_on_ghost1"]
[connection signal="pressed" from="Ghost2" to="." method="_on_ghost2"]
[connection signal="clicked" from="Ghost3" to="." method="bad-method!"]
`);
    const result = signalContractAudit(db, 'test-project', 'multi-issue.tscn');
    expect(result.pass).toBe(false);
    // At least 3 node-not-found issues + 1 method name issue
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });
});
