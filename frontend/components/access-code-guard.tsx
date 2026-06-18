'use client';

import { useEffect, useState, ReactNode } from 'react';
import { AccessCodeModal } from '@/components/access-code-modal';

export function AccessCodeGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<{
    enabled: boolean;
    authenticated: boolean;
    loading: boolean;
  }>({ enabled: false, authenticated: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/access-code/status')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setStatus({
            enabled: data.enabled,
            authenticated: data.authenticated,
            loading: false,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          // On network / parse failure, fall back to "access code NOT
          // enabled" rather than forcing the modal. The previous default
          // of `enabled: true` was a no-auth fallback: when ACCESS_CODE
          // is genuinely unset on the server, that path traps the user
          // in a modal that the server can never accept. Opting into
          // "no gate" is the correct UX for the "open by default"
          // deployment the project ships with; admins who DO want a
          // gate should be told the gate is broken via the server
          // response, not a stuck modal.
          setStatus({ enabled: false, authenticated: false, loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const needsAuth = !status.loading && status.enabled && !status.authenticated;

  return (
    <>
      {needsAuth && (
        <AccessCodeModal
          open={true}
          onSuccess={() => setStatus((s) => ({ ...s, authenticated: true }))}
        />
      )}
      {children}
    </>
  );
}
