'use client';

import { useTranslations } from 'next-intl';
import { HelpSection } from '@/components/settings/help-section';

export default function HelpPage(): React.ReactElement {
  const t = useTranslations('helpCenter');

  return (
    <main className='mx-auto w-full max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <header className='space-y-2'>
        <h1 className='font-display text-3xl font-semibold tracking-tight sm:text-4xl'>
          {t('title')}
        </h1>
        <p className='text-muted-foreground max-w-2xl text-sm leading-6 sm:text-base'>
          {t('description')}
        </p>
      </header>
      <HelpSection />
    </main>
  );
}
