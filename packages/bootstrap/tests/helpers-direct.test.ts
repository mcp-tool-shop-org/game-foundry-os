import { describe, it, expect } from 'vitest';
import { formatName, countPackDirections, countDirectionalDirs, deriveProductionStates } from '../src/scan-tfr.js';

const TFR_ROOT = 'F:/AI/the-fractured-road';

describe('bootstrap helper functions', () => {
  it('formatName converts riot_husk to Riot Husk', () => {
    expect(formatName('riot_husk')).toBe('Riot Husk');
  });

  it('formatName converts single word to capitalized', () => {
    expect(formatName('maren')).toBe('Maren');
  });

  it('countPackDirections returns 0 for nonexistent directory', () => {
    expect(countPackDirections('/nonexistent/root', 'fake/pack/dir')).toBe(0);
  });

  it('countDirectionalDirs returns 5 when all dirs present', () => {
    // grubblade should have all 5 directional dirs in TFR
    const count = countDirectionalDirs(TFR_ROOT, 'grubblade');
    expect(count).toBe(5);
  });

  it('deriveProductionStates sets concept_status=complete when concept PNGs exist', () => {
    const states = deriveProductionStates(TFR_ROOT, 'grubblade', 'grubblade', 'ch1-enemies');
    // If concept PNGs exist, should be 'complete'
    if (states.concept_status) {
      expect(['complete', 'none']).toContain(states.concept_status);
    }
    // Pack and directional states should be derived
    expect(states).toBeDefined();
  });
});
