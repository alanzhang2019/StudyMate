export function resolveAgentModeForGeneration(input: {
  sourceMode?: 'default' | 'mistake';
  agentMode: 'preset' | 'auto';
}): 'preset' | 'auto' {
  if (input.sourceMode === 'mistake') {
    return 'preset';
  }

  return input.agentMode;
}
