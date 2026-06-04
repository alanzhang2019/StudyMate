/**
 * Shared SSE (Server-Sent Events) writer for streaming API routes.
 *
 * Extracted from `app/api/generate/scene-outlines-stream/route.ts` so that
 * route handlers only export the HTTP method names (and Next.js route
 * segment config) that Next.js 16 expects.
 */

export function createSseWriter(params: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  signal?: AbortSignal;
  onClose?: () => void;
}) {
  const { controller, encoder, signal, onClose } = params;
  let closed = false;

  const close = () => {
    if (closed) return false;
    closed = true;
    if (signal) {
      signal.removeEventListener('abort', close);
    }
    onClose?.();
    try {
      controller.close();
    } catch {
      // Ignore duplicate close errors after the client disconnects.
    }
    return true;
  };

  const send = (payload: string) => {
    if (closed || signal?.aborted) return false;
    try {
      controller.enqueue(encoder.encode(payload));
      return true;
    } catch {
      close();
      return false;
    }
  };

  if (signal) {
    signal.addEventListener('abort', close, { once: true });
  }

  return {
    sendComment(comment: string) {
      return send(`:${comment}\n\n`);
    },
    sendEvent(event: unknown) {
      return send(`data: ${JSON.stringify(event)}\n\n`);
    },
    close,
    isClosed() {
      return closed || !!signal?.aborted;
    },
  };
}
