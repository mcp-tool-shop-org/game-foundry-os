import { describe, it, expect } from 'vitest';
import { parseProjectGodot, parseScene, auditImportSettings } from '@mcptoolshop/engine-bridge-mcp/lib';

describe('engine-bridge lib exports', () => {
  it('exports parseProjectGodot function', () => {
    expect(typeof parseProjectGodot).toBe('function');
  });

  it('exports parseScene function', () => {
    expect(typeof parseScene).toBe('function');
  });

  it('exports auditImportSettings function', () => {
    expect(typeof auditImportSettings).toBe('function');
  });
});
