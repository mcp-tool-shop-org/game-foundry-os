import { describe, it, expect } from 'vitest';
import { buildManifest } from '../src/tools/exportManifest.js';

describe('export manifest edge cases', () => {
  it('exports Vector2i with correct row,col order', () => {
    const manifest = buildManifest('enc1', [
      {
        display_name: 'Goblin', hp: 8, guard: 3, speed: 9, move_range: 3,
        ai_role: 'center_holder', engine_data: null,
        grid_row: 2, grid_col: 5, sprite_pack: 'ch1-enemies', variant_id: 'grubblade',
      },
    ]);

    expect(manifest.gdscript_array[0].grid_pos).toBe('Vector2i(2, 5)');
  });

  it('parses engine_data JSON back into object', () => {
    const engineJson = JSON.stringify({ phase: 1, resist: 'fire' });
    const manifest = buildManifest('enc1', [
      {
        display_name: 'Boss', hp: 18, guard: 8, speed: 9, move_range: 2,
        ai_role: 'boss', engine_data: engineJson,
        grid_row: 1, grid_col: 6, sprite_pack: 'ch1-enemies', variant_id: 'avar_armed',
      },
    ]);

    expect(manifest.gdscript_array[0].engine).toEqual({ phase: 1, resist: 'fire' });
  });

  it('handles encounter with no enemies (empty array)', () => {
    const manifest = buildManifest('empty-enc', []);
    expect(manifest.encounter_id).toBe('empty-enc');
    expect(manifest.gdscript_array).toEqual([]);
  });
});
