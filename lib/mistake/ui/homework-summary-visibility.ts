export function shouldShowHomeworkSummary(input: {
  hasSummary: boolean;
  lectureCompleted: boolean;
}) {
  return input.hasSummary && input.lectureCompleted;
}
