export function getClassroomNavigationTarget(input: {
  classroomId: string;
  source: 'generation-preview' | 'app';
}) {
  return {
    href: `/classroom/${input.classroomId}`,
    mode: 'soft' as const,
  };
}
