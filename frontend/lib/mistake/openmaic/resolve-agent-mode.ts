export function resolveAgentModeForGeneration(input: {
  agentMode: 'preset' | 'auto';
}): 'preset' | 'auto' {
  return input.agentMode;
}
