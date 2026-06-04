export function shouldEnableHomeworkWhiteboard(input: { defaultPresentation: boolean }) {
  return !input.defaultPresentation;
}

export function getNextHomeworkWhiteboardOpenState(input: {
  defaultPresentation: boolean;
  whiteboardOpen: boolean;
}) {
  if (input.defaultPresentation) {
    return false;
  }

  return !input.whiteboardOpen;
}
