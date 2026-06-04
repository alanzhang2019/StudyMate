export function shouldUseHomeworkPresentationMode(input: {
  hasMistakeSession: boolean;
  stageName: string;
}) {
  return (
    input.hasMistakeSession ||
    input.stageName.includes('小学数学错题') ||
    input.stageName.includes('单题聚焦的讲解课堂')
  );
}
