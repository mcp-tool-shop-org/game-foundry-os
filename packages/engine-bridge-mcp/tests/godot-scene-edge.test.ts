import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseScene } from '../src/utils/godot-scene.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-scene-edge-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeScene(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content);
  return p;
}

describe('parseScene edge cases', () => {
  it('parses node with multiple properties', () => {
    const scenePath = writeScene('multi.tscn', `[gd_scene format=3]

[node name="Player" type="CharacterBody2D"]
script = ExtResource("1_abc")
speed = 200
direction = Vector2(1, 0)
visible = true
`);
    const scene = parseScene(scenePath);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].name).toBe('Player');
    expect(scene.nodes[0].properties['script']).toBe('ExtResource("1_abc")');
    expect(scene.nodes[0].properties['speed']).toBe('200');
    expect(scene.nodes[0].properties['visible']).toBe('true');
  });

  it('handles node with groups attribute', () => {
    const scenePath = writeScene('groups.tscn', `[gd_scene format=3]

[node name="Enemy" type="CharacterBody2D" groups=["enemies,damageable"]]
`);
    const scene = parseScene(scenePath);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].name).toBe('Enemy');
    expect(scene.nodes[0].groups).toBeDefined();
  });

  it('handles ext_resource without uid field (pre-4.x compat)', () => {
    const scenePath = writeScene('nouid.tscn', `[gd_scene format=2]

[ext_resource type="Script" path="res://scripts/player.gd" id="1"]

[node name="Root" type="Node2D"]
`);
    const scene = parseScene(scenePath);
    expect(scene.ext_resources).toHaveLength(1);
    expect(scene.ext_resources[0].uid).toBeUndefined();
    expect(scene.ext_resources[0].path).toBe('res://scripts/player.gd');
    expect(scene.ext_resources[0].id).toBe('1');
    expect(scene.format).toBe(2);
  });

  it('handles connection with flags and binds', () => {
    const scenePath = writeScene('flags.tscn', `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Button" type="Button" parent="."]

[connection signal="pressed" from="Button" to="." method="_on_button_pressed" flags=7]
`);
    const scene = parseScene(scenePath);
    expect(scene.connections).toHaveLength(1);
    expect(scene.connections[0].flags).toBe(7);
    expect(scene.connections[0].signal).toBe('pressed');
    expect(scene.connections[0].method).toBe('_on_button_pressed');
  });

  it('handles scene with only header, no nodes', () => {
    const scenePath = writeScene('empty-nodes.tscn', `[gd_scene uid="uid://xyz999" format=3]
`);
    const scene = parseScene(scenePath);
    expect(scene.uid).toBe('uid://xyz999');
    expect(scene.format).toBe(3);
    expect(scene.nodes).toHaveLength(0);
    expect(scene.ext_resources).toHaveLength(0);
    expect(scene.connections).toHaveLength(0);
  });

  it('handles instance keyword in node (scene inheritance)', () => {
    const scenePath = writeScene('instance.tscn', `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://scenes/enemy.tscn" id="1_enemy"]

[node name="EnemyInstance" instance=ExtResource("1_enemy")]
`);
    const scene = parseScene(scenePath);
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].name).toBe('EnemyInstance');
    expect(scene.nodes[0].instance).toBeDefined();
  });
});
