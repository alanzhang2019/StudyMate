'use client';

import { useEffect } from 'react';
import { setClientVisitorId } from './client';

/**
 * Hydrates the client-side `localStorage` shadow of the visitor id
 * from a server-provided prop. Renders nothing.
 *
 * The server sets the httpOnly cookie in the root layout and passes
 * the id down as a prop. This component is the only place that
 * copies it into localStorage, which every subsequent API call
 * reads via `visitorFetch()`.
 */
export function VisitorBootstrap({ visitorId }: { visitorId: string }) {
  useEffect(() => {
    if (!visitorId) return;
    setClientVisitorId(visitorId);
  }, [visitorId]);
  return null;
}
