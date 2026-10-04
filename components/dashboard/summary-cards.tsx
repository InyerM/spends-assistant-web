'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatting';
import { calculateDashboardSummary } from '@/lib/transactions/dashboard-summary';
import { TrendingUp, TrendingDown, Scale } from 'lucide-react';
import type { Transaction } from '@/types';

interface SummaryCardsProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

export function SummaryCards({ transactions, isLoading }: SummaryCardsProps): React.ReactElement {
  const t = useTranslations('dashboard');
  const locale = useLocale();

  const stats = useMemo(() => {
    return calculateDashboardSummary(transactions);
  }, [transactions]);

  const cards = [
    {
      label: t('income'),
      value: stats.personalIncome,
      colorClass: 'text-success',
      icon: TrendingUp,
      iconBg: 'bg-success/15',
      iconColor: 'text-success',
    },
    {
      label: t('expenses'),
      value: stats.expenses,
      colorClass: 'text-brand-secondary',
      icon: TrendingDown,
      iconBg: 'bg-brand-secondary/10',
      iconColor: 'text-brand-secondary',
      prefix: '-',
    },
    {
      label: t('cashFlow'),
      value: stats.cashFlow,
      colorClass: stats.cashFlow >= 0 ? 'text-success' : 'text-destructive',
      icon: Scale,
      iconBg: 'bg-muted',
      iconColor: 'text-muted-foreground',
    },
  ];

  if (isLoading) {
    return (
      <>
        <Skeleton className='h-[52px] w-full rounded-xl sm:hidden' />
        <div className='hidden gap-4 sm:grid sm:grid-cols-3'>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-[88px] w-full rounded-xl' />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile: single card with 3 stacked rows */}
      <Card className='border-border bg-card sm:hidden'>
        <CardContent className='divide-border divide-y p-0'>
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className='flex items-center gap-3 px-3 py-2.5'>
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <span className='text-muted-foreground text-xs'>{card.label}</span>
                <span className={`ml-auto text-sm font-bold ${card.colorClass}`}>
                  {card.prefix ?? ''}
                  {formatCurrency(Math.abs(card.value), 'COP', locale)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Desktop: 3 individual cards */}
      <div className='hidden gap-4 sm:grid sm:grid-cols-3'>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className='border-border bg-card'>
              <CardContent className='flex flex-row-reverse items-start justify-between gap-3 p-5 sm:p-6'>
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${card.iconBg}`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <div className='min-w-0'>
                  <p className='text-muted-foreground mb-3 text-sm'>{card.label}</p>
                  <p
                    className={`text-2xl font-semibold tracking-tight tabular-nums lg:text-3xl ${card.colorClass}`}>
                    {card.prefix ?? ''}
                    {formatCurrency(Math.abs(card.value), 'COP', locale)}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
