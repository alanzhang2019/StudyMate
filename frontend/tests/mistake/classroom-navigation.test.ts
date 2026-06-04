import { describe, expect, it } from 'vitest';

import { getClassroomNavigationTarget } from '@/lib/mistake/ui/classroom-navigation';

describe('getClassroomNavigationTarget', () => {
  it('uses soft navigation for generation preview handoff to avoid page flash', () => {
    expect(
      getClassroomNavigationTarget({
        classroomId: 'classroom-1',
        source: 'generation-preview',
      }),
    ).toEqual({
      href: '/classroom/classroom-1',
      mode: 'soft',
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
