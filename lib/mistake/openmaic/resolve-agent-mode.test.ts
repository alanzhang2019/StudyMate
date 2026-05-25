import { describe, expect, it } from 'vitest';

import { resolveAgentModeForGeneration } from './resolve-agent-mode';

describe('resolveAgentModeForGeneration', () => {
  it('forces preset mode for mistake sessions even when global mode is auto', () => {
    expect(resolveAgentModeForGeneration({ sourceMode: 'mistake', agentMode: 'auto' })).toBe(
      'preset',
    );
  });

  it('keeps preset mode unchanged for mistake sessions', () => {
    expect(resolveAgentModeForGeneration({ sourceMode: 'mistake', agentMode: 'preset' })).toBe(
      'preset',
    );
  });

  it('keeps auto mode for non-mistake sessions', () => {
    expect(resolveAgentModeForGeneration({ sourceMode: 'default', agentMode: 'auto' })).toBe(
      'auto',
    );
  });
});
