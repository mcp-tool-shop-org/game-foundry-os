import { describe, it, expect } from 'vitest';
import { REPAIR_CATALOG, getRepairContract, findingToActionKey } from '@mcptoolshop/studio-bootstrap-core';

describe('repair catalog', () => {
  it('has 10 entries', () => {
    expect(REPAIR_CATALOG.size).toBe(10);
  });

  it('every entry has valid contract fields', () => {
    for (const [key, contract] of REPAIR_CATALOG) {
      expect(contract.action_key).toBe(key);
      expect(contract.display_name).toBeTruthy();
      expect(['safe', 'moderate', 'destructive']).toContain(contract.risk_level);
      expect(typeof contract.dry_run_supported).toBe('boolean');
      expect(Array.isArray(contract.postchecks)).toBe(true);
      expect(Array.isArray(contract.preconditions)).toBe(true);
      expect(Array.isArray(contract.expected_effects)).toBe(true);
      expect(contract.expected_effects.length).toBeGreaterThan(0);
      expect(['filesystem', 'registry', 'godot_config', 'mixed']).toContain(contract.scope);
    }
  });

  it('getRepairContract returns contract for known key', () => {
    const contract = getRepairContract('studio_install_runtime_shell');
    expect(contract).toBeDefined();
    expect(contract!.display_name).toBe('Install Runtime Shell');
  });

  it('getRepairContract returns undefined for unknown key', () => {
    expect(getRepairContract('unknown_action')).toBeUndefined();
  });

  it('findingToActionKey maps valid actions', () => {
    expect(findingToActionKey('studio_install_runtime_shell')).toBe('studio_install_runtime_shell');
    expect(findingToActionKey('godot_register_autoload')).toBe('godot_register_autoload');
  });

  it('findingToActionKey returns null for null or unknown', () => {
    expect(findingToActionKey(null)).toBeNull();
    expect(findingToActionKey('not_a_real_action')).toBeNull();
  });

  it('all studio actions have safe risk level', () => {
    const studioKeys = [...REPAIR_CATALOG.keys()].filter(k => k.startsWith('studio_'));
    for (const key of studioKeys) {
      expect(getRepairContract(key)!.risk_level).toBe('safe');
    }
  });

  it('all godot actions have moderate risk level', () => {
    const godotKeys = [...REPAIR_CATALOG.keys()].filter(k => k.startsWith('godot_'));
    for (const key of godotKeys) {
      expect(getRepairContract(key)!.risk_level).toBe('moderate');
    }
  });
});
