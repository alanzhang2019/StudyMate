import { describe, expect, it } from 'vitest';

import { resolveAgentModeForGeneration } from './resolve-agent-mode';

describe('resolveAgentModeForGeneration', () => {
  it('keeps auto mode when generation is configured for auto agents', () => {
    expect(resolveAgentModeForGeneration({ agentMode: 'auto' })).toBe('auto');
  });

  it('keeps preset mode unchanged when generation is configured for preset agents', () => {
    expect(resolveAgentModeForGeneration({ agentMode: 'preset' })).toBe('preset');
  });
});
