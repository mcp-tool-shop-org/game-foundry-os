export { registerTemplate, getTemplate, listTemplates, registerDefaultTemplates } from './templates.js';
export type { RegisterTemplateInput } from './templates.js';

export { createBootstrap, completeBootstrap, getBootstrap, getLatestBootstrap, addBootstrapArtifact, getBootstrapArtifacts } from './bootstrap.js';

export { seedProjectRegistry } from './seed-registry.js';
export type { SeedRegistryResult } from './seed-registry.js';

export { seedVault } from './seed-vault.js';
export type { SeedVaultResult } from './seed-vault.js';

export { installRuntimeShell } from './install-runtime.js';
export type { InstallRuntimeResult } from './install-runtime.js';

export { installThemeShell } from './install-theme.js';
export type { InstallThemeResult } from './install-theme.js';

export { installProofShell } from './install-proof.js';
export type { InstallProofResult } from './install-proof.js';

export { runDiagnostics } from './diagnostics.js';

export { getProjectStatus } from './project-status.js';

export { getStudioNextStep } from './next-step.js';
export type { StudioNextStep } from './next-step.js';
