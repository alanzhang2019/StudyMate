import { describe, expect, it } from 'vitest';

import {
  getClassroomLoadState,
  shouldCommitClassroomLoadUpdate,
  shouldShowClassroomLoadingOverlay,
  shouldResetClassroomLoading,
  shouldUnblockClassroomDisplay,
} from '@/lib/mistake/ui/classroom-load-state';

describe('getClassroomLoadState', () => {
  it('returns ready when IndexedDB already has a playable classroom snapshot', () => {
    expect(
      getClassroomLoadState({
        indexedDbHit: true,
        serverHit: false,
        classroomId: 'ready-id',
      }),
    ).toEqual({
      kind: 'ready',
      message: '',
    });
  });

  it('returns not-found when the classroom id is missing from both client and server storage', () => {
    expect(
      getClassroomLoadState({
        indexedDbHit: false,
        serverHit: false,
        classroomId: 'missing-id',
      }),
    ).toEqual({
      kind: 'not_found',
      message: 'Classroom not found: missing-id',
    });
  });
});

describe('shouldUnblockClassroomDisplay', () => {
  it('unblocks rendering once a ready classroom has at least one playable scene', () => {
    expect(
      shouldUnblockClassroomDisplay({
        loadStateKind: 'ready',
        stageId: 'classroom-1',
        scenesLength: 1,
      }),
    ).toBe(true);
  });

  it('keeps loading when the classroom is not found', () => {
    expect(
      shouldUnblockClassroomDisplay({
        loadStateKind: 'not_found',
        stageId: null,
        scenesLength: 0,
      }),
    ).toBe(false);
  });

  it('keeps loading when the snapshot is ready but no scenes were restored yet', () => {
    expect(
      shouldUnblockClassroomDisplay({
        loadStateKind: 'ready',
        stageId: 'classroom-1',
        scenesLength: 0,
      }),
    ).toBe(false);
  });
});

describe('shouldCommitClassroomLoadUpdate', () => {
  it('blocks state updates after a classroom load has been cancelled', () => {
    expect(
      shouldCommitClassroomLoadUpdate({
        cancelled: true,
      }),
    ).toBe(false);
  });

  it('allows state updates while the current classroom load is still active', () => {
    expect(
      shouldCommitClassroomLoadUpdate({
        cancelled: false,
      }),
    ).toBe(true);
  });
});

describe('shouldResetClassroomLoading', () => {
  it('keeps the classroom visible when the same classroom already has playable scenes in store', () => {
    expect(
      shouldResetClassroomLoading({
        classroomId: 'classroom-1',
        currentStageId: 'classroom-1',
        scenesLength: 1,
      }),
    ).toBe(false);
  });

  it('shows loading when entering a different classroom or when scenes are still missing', () => {
    expect(
      shouldResetClassroomLoading({
        classroomId: 'classroom-1',
        currentStageId: 'classroom-2',
        scenesLength: 1,
      }),
    ).toBe(true);

    expect(
      shouldResetClassroomLoading({
        classroomId: 'classroom-1',
        currentStageId: 'classroom-1',
        scenesLength: 0,
      }),
    ).toBe(true);
  });
});

describe('shouldShowClassroomLoadingOverlay', () => {
  it('hides the loading overlay when the current classroom already has a playable scene', () => {
    expect(
      shouldShowClassroomLoadingOverlay({
        loading: true,
        classroomId: 'classroom-1',
        currentStageId: 'classroom-1',
        scenesLength: 1,
      }),
    ).toBe(false);
  });

  it('shows the loading overlay when the current classroom snapshot is still missing', () => {
    expect(
      shouldShowClassroomLoadingOverlay({
        loading: true,
        classroomId: 'classroom-1',
        currentStageId: null,
        scenesLength: 0,
      }),
    ).toBe(true);
  });

  it('stays hidden after loading finishes', () => {
    expect(
      shouldShowClassroomLoadingOverlay({
        loading: false,
        classroomId: 'classroom-1',
        currentStageId: null,
        scenesLength: 0,
      }),
    ).toBe(false);
  });
});
