import { describe, expect, it } from 'vitest';

import { shouldClearGenerationPreviewSession } from '@/lib/mistake/ui/generation-preview-session';

describe('shouldClearGenerationPreviewSession', () => {
  it('keeps the preview session after generation fails so refresh can recover the flow', () => {
    expect(
      shouldClearGenerationPreviewSession({
        outcome: 'error',
      }),
    ).toBe(false);
  });

  it('clears the preview session after successful handoff to classroom', () => {
    expect(
      shouldClearGenerationPreviewSession({
        outcome: 'success',
      }),
    ).toBe(true);
  });

  it('clears the preview session when the user explicitly leaves the flow', () => {
    expect(
      shouldClearGenerationPreviewSession({
        outcome: 'exit',
      }),
    ).toBe(true);
  });
});
