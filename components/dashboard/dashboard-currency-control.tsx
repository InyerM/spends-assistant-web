'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { CurrencyBalance } from '@/lib/account-currency-balances';

export function DashboardCurrencyControl({
  balances,
  currency,
  onCurrencyChange,
  isLoading = false,
}: {
  balances: CurrencyBalance[];
  currency: string;
  onCurrencyChange: (currency: string) => void;
  isLoading?: boolean;
}): React.ReactElement | null {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  if (isLoading) return <Skeleton className='h-11 w-36 rounded-full' />;
  if (balances.length === 0) return null;
  const index = Math.max(
    0,
    balances.findIndex((balance) => balance.currency === currency),
  );
  return (
    <div
      role='group'
      aria-label={t('displayCurrency')}
      className='border-border bg-card inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-1'
      onKeyDown={(event) => {
        const next = {
          ArrowLeft: index - 1,
          ArrowRight: index + 1,
          Home: 0,
          End: balances.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        if (balances[next]) onCurrencyChange(balances[next].currency);
      }}>
      {balances.length > 1 && (
        <Button
          variant='ghost'
          size='icon'
          className='size-11 rounded-full'
          aria-label={common('back')}
          disabled={index === 0}
          onClick={() => onCurrencyChange(balances[index - 1].currency)}>
          <ChevronLeft className='size-4' aria-hidden='true' />
        </Button>
      )}
      <span
        role='status'
        aria-live='polite'
        aria-atomic='true'
        className='text-foreground min-w-11 px-2 text-center text-sm font-medium tabular-nums'>
        {balances[index].currency}
      </span>
      {balances.length > 1 && (
        <Button
          variant='ghost'
          size='icon'
          className='size-11 rounded-full'
          aria-label={common('next')}
          disabled={index === balances.length - 1}
          onClick={() => onCurrencyChange(balances[index + 1].currency)}>
          <ChevronRight className='size-4' aria-hidden='true' />
        </Button>
      )}
    </div>
  );
}
