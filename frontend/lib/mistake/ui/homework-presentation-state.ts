export function getNextHomeworkPresentationState(input: {
  defaultPresentation: boolean;
  isFullscreenActive: boolean;
}) {
  return input.defaultPresentation || input.isFullscreenActive;
}
