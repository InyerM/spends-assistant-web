'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';

export function AuthInitializer({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  return <>{children}</>;
}
