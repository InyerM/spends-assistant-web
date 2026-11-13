'use client';

import { useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatting';

export function CashFlowCurrencyCard({
  value,
  currency,
  currencies,
  onCurrencyChange,
  isLoading,
}: {
  value: number;
  currency: string;
  currencies: string[];
  onCurrencyChange?: (currency: string) => void;
  isLoading?: boolean;
}): React.ReactElement {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  const locale = useLocale();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = currencies.indexOf(currency);
  const interactive = Boolean(onCurrencyChange && currencies.length > 1 && index >= 0);
  const amount = formatCurrency(value, currency, locale);
  const select = (next: number): void => {
    if (interactive && currencies[next]) onCurrencyChange?.(currencies[next]);
  };

  return (
    <Card
      role='region'
      aria-label={t('cashFlow')}
      tabIndex={interactive ? 0 : undefined}
      className='border-success/25 bg-success/10 focus-visible:outline-ring @container col-span-2 min-w-0 gap-0 rounded-2xl p-5 focus-visible:outline-2 focus-visible:outline-offset-4 @min-[640px]/summary:col-span-1'
      onKeyDown={(event) => {
        const next = {
          ArrowLeft: index - 1,
          ArrowRight: index + 1,
          Home: 0,
          End: currencies.length - 1,
        }[event.key];
        if (interactive && next !== undefined) {
          event.preventDefault();
          select(next);
        }
      }}
      onTouchStart={(event) => {
        const point = Array.from(event.touches).at(0);
        touch.current = point ? { x: point.clientX, y: point.clientY } : null;
      }}
      onTouchCancel={() => {
        touch.current = null;
      }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        const end = Array.from(event.changedTouches).at(0);
        if (!start || !end) return;
        const dx = end.clientX - start.x;
        if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(end.clientY - start.y) * 1.5)
          select(index + (dx < 0 ? 1 : -1));
      }}>
      <h2 className='text-foreground text-sm font-medium'>{t('cashFlow')}</h2>
      <div className='my-4 min-w-0' aria-live='polite' aria-atomic='true' aria-busy={isLoading}>
        {isLoading ? (
          <Skeleton className='h-11 w-3/4' />
        ) : (
          <p
            data-summary-value
            style={{
              fontSize: `clamp(1.25rem, calc(100cqi / ${Math.max(amount.length, 8) * 0.61}), 2.75rem)`,
            }}
            className={`leading-tight font-semibold tracking-tight [overflow-wrap:anywhere] tabular-nums ${value < 0 ? 'text-destructive' : 'text-foreground'}`}>
            {amount}
          </p>
        )}
        <p className='text-muted-foreground mt-1.5 text-sm'>{currency}</p>
      </div>
      {interactive ? (
        <div
          role='group'
          aria-label={t('displayCurrency')}
          className='mt-auto flex flex-wrap items-center justify-between gap-x-2'>
          <div className='flex max-w-full flex-wrap'>
            {currencies.map((item) => (
              <Button
                key={item}
                variant='ghost'
                size='icon'
                className='size-11 rounded-full'
                aria-label={t('currencyPage', { currency: item })}
                aria-current={item === currency ? 'true' : undefined}
                onClick={() => onCurrencyChange?.(item)}>
                <span
                  aria-hidden='true'
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-200 motion-reduce:transition-none ${item === currency ? 'bg-foreground w-5' : 'bg-foreground/25 w-1.5'}`}
                />
              </Button>
            ))}
          </div>
          <div className='flex gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='size-11 rounded-full'
              aria-label={common('back')}
              disabled={index === 0}
              onClick={() => select(index - 1)}>
              <ChevronLeft className='size-4' aria-hidden='true' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='size-11 rounded-full'
              aria-label={common('next')}
              disabled={index === currencies.length - 1}
              onClick={() => select(index + 1)}>
              <ChevronRight className='size-4' aria-hidden='true' />
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
