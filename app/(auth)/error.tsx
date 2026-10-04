'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  const t = useTranslations('errors');
  const common = useTranslations('common');
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className='flex min-h-[50vh] flex-col items-center justify-center gap-4'>
      <h2 className='text-lg font-semibold'>{t('serverError')}</h2>
      <Button onClick={reset} size='sm'>
        {common('tryAgain')}
      </Button>
    </div>
  );
}
