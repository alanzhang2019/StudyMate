import { describe, expect, it } from 'vitest';

import { getClassroomNavigationTarget } from '@/lib/mistake/ui/classroom-navigation';

describe('getClassroomNavigationTarget', () => {
  it('uses hard navigation for generation preview handoff', () => {
    expect(
      getClassroomNavigationTarget({
        classroomId: 'classroom-1',
        source: 'generation-preview',
      }),
    ).toEqual({
      href: '/classroom/classroom-1',
      mode: 'hard',
    });
  });

  it('keeps soft navigation for regular in-app classroom entry', () => {
    expect(
      getClassroomNavigationTarget({
        classroomId: 'classroom-1',
        source: 'app',
      }),
    ).toEqual({
      href: '/classroom/classroom-1',
      mode: 'soft',
    });
  });
});
