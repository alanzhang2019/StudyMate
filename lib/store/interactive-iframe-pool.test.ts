import { beforeEach, describe, expect, it } from 'vitest';
import {
  IFRAME_POOL_CAP,
  useInteractiveIframePool,
} from '@/lib/store/interactive-iframe-pool';

describe('interactive iframe pool', () => {
  beforeEach(() => {
    useInteractiveIframePool.getState().reset();
  });

  it('keeps an existing entry when the same scene remounts with identical content', () => {
    const store = useInteractiveIframePool.getState();

    store.mount('scene-a', { srcDoc: '<html>a</html>' });
    const first = useInteractiveIframePool.getState().entries['scene-a'];

    store.mount('scene-a', { srcDoc: '<html>a</html>' });
    const second = useInteractiveIframePool.getState().entries['scene-a'];

    expect(second.srcDoc).toBe('<html>a</html>');
    expect(second.rect).toBe(first.rect);
    expect(second.tick).toBeGreaterThan(first.tick);
  });

  it('releases visibility only for the current owner', () => {
    const store = useInteractiveIframePool.getState();

    store.mount('scene-a', { srcDoc: '<html>a</html>' });
    store.claim('scene-a', 'owner-1');
    store.release('scene-a', 'stale-owner');

    expect(useInteractiveIframePool.getState().entries['scene-a'].owner).toBe('owner-1');

    store.release('scene-a', 'owner-1');

    expect(useInteractiveIframePool.getState().entries['scene-a'].owner).toBeNull();
  });

  it('evicts least-recent entries but never the active scene', () => {
    const store = useInteractiveIframePool.getState();

    for (let i = 0; i < IFRAME_POOL_CAP; i++) {
      store.mount(`scene-${i}`, { srcDoc: `<html>${i}</html>` });
    }

    store.setActive(`scene-${IFRAME_POOL_CAP - 1}`);
    store.mount('scene-extra', { srcDoc: '<html>extra</html>' });

    expect(
      useInteractiveIframePool.getState().entries[`scene-${IFRAME_POOL_CAP - 1}`],
    ).toBeDefined();
  });
});
