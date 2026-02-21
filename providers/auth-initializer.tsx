'use client';

import { useAuthStore } from '@/store/auth-store';

function trackSession(): void {
  fetch('/api/settings/sessions/track', { method: 'POST' }).catch(() => {
    // Fire-and-forget — silently ignore tracking errors
  });
}

let didInit = false;

export function AuthInitializer({ children }: { children: React.ReactNode }): React.ReactElement {
  if (!didInit) {
    didInit = true;
    void useAuthStore
      .getState()
      .initialize()
      .then(() => {
        const { isAuthenticated } = useAuthStore.getState();
        if (isAuthenticated) {
          trackSession();
        }
      });
  }

  return <>{children}</>;
}
