import { describe, expect, it } from 'vitest';

import {
  parseStoredClassroomGenerationParams,
  shouldDiscardPersistedClassroomOutlines,
  shouldResumeClassroomGeneration,
} from '@/lib/mistake/ui/classroom-generation-resume';

describe('shouldResumeClassroomGeneration', () => {
  it('does not resume when pending outlines exist but generation params are missing', () => {
    expect(
      shouldResumeClassroomGeneration({
        hasPendingOutlines: true,
        generationParams: null,
      }),
    ).toBe(false);
  });

  it('does not resume when storage only contains an empty params object', () => {
    expect(parseStoredClassroomGenerationParams('{}')).toBeNull();

    expect(
      shouldResumeClassroomGeneration({
        hasPendingOutlines: true,
        generationParams: parseStoredClassroomGenerationParams('{}'),
      }),
    ).toBe(false);
  });

  it('resumes when pending outlines exist and preview handed off valid params', () => {
    const params = parseStoredClassroomGenerationParams(
      JSON.stringify({
        sourceMode: 'mistake',
        mistakeSessionId: 'session-1',
        languageDirective: '中文',
      }),
    );

    expect(
      shouldResumeClassroomGeneration({
        hasPendingOutlines: true,
        generationParams: params,
      }),
    ).toBe(true);
  });

  it('does not resume when there are no pending outlines', () => {
    const params = parseStoredClassroomGenerationParams(
      JSON.stringify({
        sourceMode: 'mistake',
        mistakeSessionId: 'session-1',
      }),
    );

    expect(
      shouldResumeClassroomGeneration({
        hasPendingOutlines: false,
        generationParams: params,
      }),
    ).toBe(false);
  });
});

describe('shouldDiscardPersistedClassroomOutlines', () => {
  it('discards outlines when classroom already has playable scenes but handoff params are missing', () => {
    expect(
      shouldDiscardPersistedClassroomOutlines({
        generationParams: null,
        scenesLength: 1,
        outlinesLength: 7,
      }),
    ).toBe(true);
  });

  it('keeps outlines when preview handoff params still exist', () => {
    expect(
      shouldDiscardPersistedClassroomOutlines({
        generationParams: parseStoredClassroomGenerationParams(
          JSON.stringify({
            sourceMode: 'mistake',
            mistakeSessionId: 'session-1',
          }),
        ),
        scenesLength: 1,
        outlinesLength: 7,
      }),
    ).toBe(false);
  });

  it('keeps outlines when there are no playable scenes yet', () => {
    expect(
      shouldDiscardPersistedClassroomOutlines({
        generationParams: null,
        scenesLength: 0,
        outlinesLength: 7,
      }),
    ).toBe(false);
  });
});
