import { describe, expect, it } from 'vitest';

import {
  getNextHomeworkWhiteboardOpenState,
  shouldEnableHomeworkWhiteboard,
} from '@/lib/mistake/ui/homework-whiteboard-guard';

describe('getNextHomeworkWhiteboardOpenState', () => {
  it('disables whiteboard controls for homework presentation classrooms', () => {
    expect(
      shouldEnableHomeworkWhiteboard({
        defaultPresentation: true,
      }),
    ).toBe(false);

    expect(
      shouldEnableHomeworkWhiteboard({
        defaultPresentation: false,
      }),
    ).toBe(true);
  });

  it('keeps whiteboard closed for homework presentation classrooms', () => {
    expect(
      getNextHomeworkWhiteboardOpenState({
        defaultPresentation: true,
        whiteboardOpen: false,
      }),
    ).toBe(false);

    expect(
      getNextHomeworkWhiteboardOpenState({
        defaultPresentation: true,
        whiteboardOpen: true,
      }),
    ).toBe(false);
  });

  it('toggles whiteboard normally for standard classrooms', () => {
    expect(
      getNextHomeworkWhiteboardOpenState({
        defaultPresentation: false,
        whiteboardOpen: false,
      }),
    ).toBe(true);

    expect(
      getNextHomeworkWhiteboardOpenState({
        defaultPresentation: false,
        whiteboardOpen: true,
      }),
    ).toBe(false);
  });
});
