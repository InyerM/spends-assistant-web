'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';

function trackSession(): void {
  fetch('/api/settings/sessions/track', { method: 'POST' }).catch(() => {
    // Fire-and-forget — silently ignore tracking errors
  });
}

export function AuthInitializer({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    void useAuthStore
      .getState()
      .initialize()
      .then(() => {
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
          trackSession();
        }
      });
  }, []);

  return <>{children}</>;
}
