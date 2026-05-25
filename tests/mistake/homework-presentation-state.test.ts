import { describe, expect, it } from 'vitest';

import { getNextHomeworkPresentationState } from '@/lib/mistake/ui/homework-presentation-state';

describe('getNextHomeworkPresentationState', () => {
  it('keeps homework classrooms in presentation layout after fullscreen exits', () => {
    expect(
      getNextHomeworkPresentationState({
        defaultPresentation: true,
        isFullscreenActive: false,
      }),
    ).toBe(true);
  });

  it('follows fullscreen state for standard classrooms', () => {
    expect(
      getNextHomeworkPresentationState({
        defaultPresentation: false,
        isFullscreenActive: true,
      }),
    ).toBe(true);

    expect(
      getNextHomeworkPresentationState({
        defaultPresentation: false,
        isFullscreenActive: false,
      }),
    ).toBe(false);
  });
});
