export function getClassroomNavigationTarget(input: {
  classroomId: string;
  source: 'generation-preview' | 'app';
}) {
  return {
    href: `/classroom/${input.classroomId}`,
    mode: input.source === 'generation-preview' ? ('hard' as const) : ('soft' as const),
  };
}
