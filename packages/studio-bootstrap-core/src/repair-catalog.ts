import type { RepairActionContract } from '@mcptoolshop/game-foundry-registry';

/** Static repair action catalog — compile-time map of action_key → contract */
export const REPAIR_CATALOG: Map<string, RepairActionContract> = new Map([
  ['studio_install_runtime_shell', {
    action_key: 'studio_install_runtime_shell',
    display_name: 'Install Runtime Shell',
    risk_level: 'safe',
    dry_run_supported: true,
    postchecks: ['template_shell_verify', 'inspect_project'],
    preconditions: ['project_exists_in_registry'],
    expected_effects: ['Creates project.godot', 'Creates 4 battle GDScript files', 'Creates asset directories'],
    scope: 'filesystem',
  }],
  ['studio_install_theme_shell', {
    action_key: 'studio_install_theme_shell',
    display_name: 'Install Theme Shell',
    risk_level: 'safe',
    dry_run_supported: true,
    postchecks: ['template_shell_verify'],
    preconditions: ['project_exists_in_registry'],
    expected_effects: ['Creates type_system.gd', 'Creates theme and font directories'],
    scope: 'filesystem',
  }],
  ['studio_install_proof_shell', {
    action_key: 'studio_install_proof_shell',
    display_name: 'Install Proof Shell',
    risk_level: 'safe',
    dry_run_supported: true,
    postchecks: [],
    preconditions: ['project_exists_in_registry'],
    expected_effects: ['Seeds proof suites and freeze policies in registry'],
    scope: 'registry',
  }],
  ['studio_seed_vault', {
    action_key: 'studio_seed_vault',
    display_name: 'Seed Canon Vault',
    risk_level: 'safe',
    dry_run_supported: true,
    postchecks: [],
    preconditions: ['project_exists_in_registry'],
    expected_effects: ['Creates canon vault directory structure'],
    scope: 'filesystem',
  }],
  ['studio_seed_registry', {
    action_key: 'studio_seed_registry',
    display_name: 'Seed Registry',
    risk_level: 'safe',
    dry_run_supported: true,
    postchecks: [],
    preconditions: ['project_exists_in_registry'],
    expected_effects: ['Seeds default proof suites and freeze policies'],
    scope: 'registry',
  }],
  ['godot_register_autoload', {
    action_key: 'godot_register_autoload',
    display_name: 'Register Autoload',
    risk_level: 'moderate',
    dry_run_supported: true,
    postchecks: ['autoload_contract'],
    preconditions: ['project_godot_exists'],
    expected_effects: ['Adds autoload entry to project.godot [autoload] section'],
    scope: 'godot_config',
  }],
  ['godot_enable_plugin', {
    action_key: 'godot_enable_plugin',
    display_name: 'Enable Plugin',
    risk_level: 'moderate',
    dry_run_supported: true,
    postchecks: ['inspect_project'],
    preconditions: ['project_godot_exists'],
    expected_effects: ['Adds plugin to project.godot [editor_plugins] section'],
    scope: 'godot_config',
  }],
  ['godot_apply_display_setting', {
    action_key: 'godot_apply_display_setting',
    display_name: 'Apply Display Setting',
    risk_level: 'moderate',
    dry_run_supported: true,
    postchecks: ['inspect_project'],
    preconditions: ['project_godot_exists'],
    expected_effects: ['Updates display setting in project.godot'],
    scope: 'godot_config',
  }],
  ['godot_apply_rendering_setting', {
    action_key: 'godot_apply_rendering_setting',
    display_name: 'Apply Rendering Setting',
    risk_level: 'moderate',
    dry_run_supported: true,
    postchecks: ['inspect_project'],
    preconditions: ['project_godot_exists'],
    expected_effects: ['Updates rendering setting in project.godot'],
    scope: 'godot_config',
  }],
  ['godot_seed_export_preset', {
    action_key: 'godot_seed_export_preset',
    display_name: 'Seed Export Preset',
    risk_level: 'moderate',
    dry_run_supported: true,
    postchecks: ['export_audit'],
    preconditions: ['project_godot_exists'],
    expected_effects: ['Creates or repairs export_presets.cfg with a default preset'],
    scope: 'filesystem',
  }],
]);

/** Look up a repair contract by action key */
export function getRepairContract(actionKey: string): RepairActionContract | undefined {
  return REPAIR_CATALOG.get(actionKey);
}

/** Map a finding's repair_action to a catalog action key (passthrough if valid) */
export function findingToActionKey(repairAction: string | null): string | null {
  if (!repairAction) return null;
  return REPAIR_CATALOG.has(repairAction) ? repairAction : null;
}
