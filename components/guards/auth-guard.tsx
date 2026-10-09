'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { TermsAcceptanceGate } from '@/components/guards/terms-acceptance-gate';
import { Loader } from '@/components/shared/loader';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): React.ReactNode {
  const { isAuthenticated, isLoading } = useAuth();
  const t = useTranslations('common');
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className='bg-background flex min-h-screen items-center justify-center'>
        <Loader text={t('loading')} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <TermsAcceptanceGate>{children}</TermsAcceptanceGate>;
}
