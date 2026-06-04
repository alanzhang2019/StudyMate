export function getClassroomLoadState(input: {
  indexedDbHit: boolean;
  serverHit: boolean;
  classroomId: string;
}) {
  if (input.indexedDbHit || input.serverHit) {
    return {
      kind: 'ready' as const,
      message: '',
    };
  }

  return {
    kind: 'not_found' as const,
    message: `Classroom not found: ${input.classroomId}`,
  };
}

export function shouldUnblockClassroomDisplay(input: {
  loadStateKind: 'ready' | 'not_found';
  stageId: string | null;
  scenesLength: number;
}) {
  return input.loadStateKind === 'ready' && Boolean(input.stageId) && input.scenesLength > 0;
}

export function shouldCommitClassroomLoadUpdate(input: { cancelled: boolean }) {
  return !input.cancelled;
}

export function shouldResetClassroomLoading(input: {
  classroomId: string;
  currentStageId: string | null;
  scenesLength: number;
}) {
  return !(input.currentStageId === input.classroomId && input.scenesLength > 0);
}

export function shouldShowClassroomLoadingOverlay(input: {
  loading: boolean;
  classroomId: string;
  currentStageId: string | null;
  scenesLength: number;
}) {
  return (
    input.loading &&
    shouldResetClassroomLoading({
      classroomId: input.classroomId,
      currentStageId: input.currentStageId,
      scenesLength: input.scenesLength,
    })
  );
}
