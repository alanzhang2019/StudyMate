export function shouldClearGenerationPreviewSession(input: {
  outcome: 'success' | 'exit' | 'error';
}) {
  return input.outcome !== 'error';
}
