import { describe, expect, it } from 'vitest';

import { getHomeworkResultShellLayout } from '@/lib/mistake/ui/homework-result-layout';

describe('getHomeworkResultShellLayout', () => {
  it('keeps the stage as the primary viewport and renders summary as an overlay panel', () => {
    const layout = getHomeworkResultShellLayout(false);

    expect(layout.rootClassName).toContain('relative');
    expect(layout.rootClassName).toContain('flex-1');
    expect(layout.stageHostClassName).toContain('absolute');
    expect(layout.stageHostClassName).toContain('inset-0');
    expect(layout.summaryPanelClassName).toContain('absolute');
    expect(layout.summaryPanelClassName).toContain('bottom-4');
    expect(layout.summaryPanelClassName).toContain('right-4');
    expect(layout.summaryCardClassName).toContain('max-w-md');
  });
});
