export type ClassroomNavigationMode = 'soft' | 'hard';

export function getClassroomNavigationTarget(input: {
  classroomId: string;
  source: 'generation-preview' | 'app';
}): { href: string; mode: ClassroomNavigationMode } {
  return {
    href: `/classroom/${input.classroomId}`,
    mode: 'soft' as const,
  };
}
