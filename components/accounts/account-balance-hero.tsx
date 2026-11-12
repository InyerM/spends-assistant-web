'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/formatting';
import type { Account } from '@/types';

export function AccountBalanceHero({
  ledgers,
  selectedId,
  onSelect,
}: {
  ledgers: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
}): React.ReactElement {
  const t = useTranslations('accounts');
  const common = useTranslations('common');
  const locale = useLocale();
  const track = useRef<HTMLDivElement>(null);
  const pagination = useRef<HTMLDivElement>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const target = useRef<number | null>(null);
  const index = Math.max(
    0,
    ledgers.findIndex((ledger) => ledger.id === selectedId),
  );

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const align = (behavior: ScrollBehavior): void => {
      target.current = element.clientWidth ? element.clientWidth * index : null;
      element.scrollTo({ left: element.clientWidth * index, behavior });
    };
    const navigation = pagination.current;
    const dot = navigation?.children.item(index) as HTMLElement | null | undefined;
    if (navigation && dot)
      navigation.scrollTo({
        left:
          dot.offsetLeft - navigation.offsetLeft - (navigation.clientWidth - dot.clientWidth) / 2,
        behavior: 'instant',
      });
    align(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth');
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      align('instant');
    });
    observer.observe(element);
    return (): void => {
      observer.disconnect();
      if (pending.current) clearTimeout(pending.current);
    };
  }, [index, selectedId, ledgers.length]);

  const settle = (): void => {
    if (pending.current) clearTimeout(pending.current);
    const element = track.current;
    if (!element?.clientWidth || ledgers.length === 0) return;
    if (target.current !== null && Math.abs(element.scrollLeft - target.current) > 2) return;
    target.current = null;
    const settledIndex = Math.max(
      0,
      Math.min(ledgers.length - 1, Math.round(element.scrollLeft / element.clientWidth)),
    );
    const ledger = ledgers.at(settledIndex);
    if (ledger && ledger.id !== selectedId) onSelect(ledger.id);
  };

  return (
    <section
      role='region'
      aria-label={t('balanceCurrency')}
      className='bg-brand/10 min-w-0 overflow-hidden rounded-2xl'
      onKeyDown={(event) => {
        const next = {
          ArrowLeft: index - 1,
          ArrowRight: index + 1,
          Home: 0,
          End: ledgers.length - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        if (ledgers[next]) {
          (pagination.current?.children.item(next) as HTMLElement | null)?.focus({
            preventScroll: true,
          });
          onSelect(ledgers[next].id);
        }
      }}>
      <div
        ref={track}
        className='flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        onPointerDown={() => {
          target.current = null;
        }}
        onWheel={() => {
          target.current = null;
        }}
        onScroll={() => {
          if (pending.current) clearTimeout(pending.current);
          pending.current = setTimeout(settle, 150);
        }}
        onScrollEnd={settle}>
        {ledgers.map((ledger) => (
          <div
            key={ledger.id}
            aria-hidden={ledger.id !== selectedId}
            className='w-full min-w-0 shrink-0 snap-center px-5 pt-8 pb-5 sm:px-8 sm:pt-10'>
            <p className='text-foreground/80 text-sm'>
              {t('currentBalance')} · {ledger.currency}
            </p>
            <p className='text-foreground mt-4 text-[clamp(2rem,5vw,4.5rem)] leading-tight font-semibold tracking-tight wrap-anywhere tabular-nums'>
              {formatCurrency(ledger.balance, ledger.currency, locale)}
            </p>
            <p className='text-foreground/80 mt-3 max-w-lg text-sm'>{t('separateBalances')}</p>
          </div>
        ))}
      </div>
      {ledgers.length > 1 && (
        <div className='flex items-center justify-between px-4 pb-5 sm:px-7'>
          <Button
            variant='ghost'
            size='icon'
            className='size-11'
            aria-label={common('back')}
            disabled={index === 0}
            onClick={() => onSelect(ledgers[index - 1].id)}>
            <ChevronLeft aria-hidden='true' className='size-5' />
          </Button>
          <div
            ref={pagination}
            role='group'
            aria-label={t('balanceCurrency')}
            className='flex min-w-0 items-center overflow-x-auto [scrollbar-width:none]'>
            {ledgers.map((ledger) => (
              <Button
                key={ledger.id}
                variant='ghost'
                size='icon'
                className='size-11'
                aria-label={`${t('balanceCurrency')}: ${ledger.currency}`}
                aria-pressed={ledger.id === selectedId}
                onClick={() => onSelect(ledger.id)}>
                <span
                  aria-hidden='true'
                  className={
                    ledger.id === selectedId
                      ? 'bg-brand h-2 w-6 rounded-full'
                      : 'bg-foreground/40 size-2 rounded-full'
                  }
                />
              </Button>
            ))}
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='size-11'
            aria-label={common('next')}
            disabled={index === ledgers.length - 1}
            onClick={() => onSelect(ledgers[index + 1].id)}>
            <ChevronRight aria-hidden='true' className='size-5' />
          </Button>
        </div>
      )}
      <p role='status' className='sr-only'>
        {ledgers[index]?.currency}
      </p>
    </section>
  );
}
