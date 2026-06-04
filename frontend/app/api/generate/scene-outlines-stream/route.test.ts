import { describe, expect, it, vi } from 'vitest';

import { createSseWriter } from './route';

describe('createSseWriter', () => {
  it('returns false instead of throwing after the request is aborted', () => {
    const controller = {
      enqueue: vi.fn(),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;
    const abortController = new AbortController();

    const writer = createSseWriter({
      controller,
      encoder: new TextEncoder(),
      signal: abortController.signal,
    });

    abortController.abort();

    expect(writer.sendEvent({ type: 'retry' })).toBe(false);
    expect(controller.enqueue).not.toHaveBeenCalled();
    expect(controller.close).toHaveBeenCalledTimes(1);
  });

  it('swallows controller closed errors and closes only once', () => {
    const controller = {
      enqueue: vi.fn(() => {
        throw new TypeError('Invalid state: Controller is already closed');
      }),
      close: vi.fn(),
    } as unknown as ReadableStreamDefaultController<Uint8Array>;

    const writer = createSseWriter({
      controller,
      encoder: new TextEncoder(),
    });

    expect(writer.sendEvent({ type: 'retry' })).toBe(false);
    writer.close();
    writer.close();

    expect(controller.enqueue).toHaveBeenCalledTimes(1);
    expect(controller.close).toHaveBeenCalledTimes(1);
  });
});
