'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CashFlowCurrencyCard } from '@/components/dashboard/cash-flow-currency-card';
import { formatCurrency } from '@/lib/utils/formatting';
import { calculateDashboardSummary } from '@/lib/transactions/dashboard-summary';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { Transaction } from '@/types';

interface SummaryCardsProps {
  currency?: string;
  currencies?: string[];
  onCurrencyChange?: (currency: string) => void;
  transactions: Transaction[];
  isLoading?: boolean;
}

export function SummaryCards({
  transactions,
  isLoading,
  currency = 'COP',
  currencies,
  onCurrencyChange,
}: SummaryCardsProps): React.ReactElement {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const stats = useMemo(
    () =>
      calculateDashboardSummary(transactions.filter((tx) => (tx.currency ?? 'COP') === currency)),
    [transactions, currency],
  );
  const cards = [
    { label: t('income'), value: stats.personalIncome, color: 'text-success', icon: TrendingUp },
    {
      label: t('expenses'),
      value: -stats.expenses,
      color: 'text-brand-secondary',
      icon: TrendingDown,
    },
  ];
  return (
    <div className='@container/summary'>
      <div className='grid grid-cols-2 gap-3 @min-[640px]/summary:grid-cols-[1.2fr_1fr_1fr] @min-[640px]/summary:gap-4'>
        <CashFlowCurrencyCard
          value={stats.cashFlow}
          currency={currency}
          currencies={currencies ?? [currency]}
          onCurrencyChange={onCurrencyChange}
          isLoading={isLoading}
        />
        {cards.map((card) => {
          const Icon = card.icon;
          const amount = formatCurrency(card.value, currency, locale);
          return (
            <Card
              key={card.label}
              className='@container min-w-0 justify-center gap-3 rounded-2xl p-4 sm:p-5'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-muted-foreground text-xs sm:text-sm'>{card.label}</p>
                <Icon className={`size-4 shrink-0 ${card.color}`} aria-hidden='true' />
              </div>
              {isLoading ? (
                <Skeleton className='h-8 w-full' />
              ) : (
                <p
                  data-summary-value
                  style={{
                    fontSize: `clamp(0.875rem, calc(100cqi / ${Math.max(amount.length, 8) * 0.64}), 1.875rem)`,
                  }}
                  className={`min-w-0 font-semibold tracking-tight [overflow-wrap:anywhere] tabular-nums ${card.color}`}>
                  {amount}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
