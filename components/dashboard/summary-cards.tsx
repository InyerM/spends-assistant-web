'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { TrendingUp, TrendingDown, Scale, Wallet } from 'lucide-react';

interface SummaryCardsProps {
  year: number;
  month: number;
}

export function SummaryCards({ year, month }: SummaryCardsProps): React.ReactElement {
  const t = useTranslations('dashboard');
  const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: accounts, isLoading: accLoading } = useAccounts();
  const { data: txResult, isLoading: txLoading } = useTransactions({
    date_from: dateFrom,
    date_to: dateTo,
    limit: 500,
  });

  const stats = useMemo(() => {
    const transactions = txResult?.data ?? [];
    let income = 0;
    let expenses = 0;

    for (const tx of transactions) {
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expenses += tx.amount;
    }

    const totalBalance = accounts?.reduce((sum, acc) => sum + acc.balance, 0) ?? 0;
    const cashFlow = income - expenses;

    return { totalBalance, income, expenses, cashFlow };
  }, [txResult?.data, accounts]);

  if (accLoading || txLoading) {
    return (
      <div className='grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4'>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className='h-[88px] w-full rounded-xl' />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: t('totalBalance'),
      value: stats.totalBalance,
      colorClass: stats.totalBalance >= 0 ? 'text-success' : 'text-destructive',
      icon: Wallet,
      iconColor: 'text-blue-400',
    },
    {
      label: t('income'),
      value: stats.income,
      colorClass: 'text-success',
      icon: TrendingUp,
      iconColor: 'text-success',
    },
    {
      label: t('expenses'),
      value: stats.expenses,
      colorClass: 'text-destructive',
      icon: TrendingDown,
      iconColor: 'text-destructive',
      prefix: '-',
    },
    {
      label: t('cashFlow'),
      value: stats.cashFlow,
      colorClass: stats.cashFlow >= 0 ? 'text-success' : 'text-destructive',
      icon: Scale,
      iconColor: 'text-transfer',
    },
  ];

  return (
    <div className='grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4'>
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className='border-border bg-card'>
            <CardContent className='flex items-center gap-3 p-3 sm:gap-4 sm:p-4'>
              <div className='bg-card-overlay flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10'>
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
              </div>
              <div className='min-w-0'>
                <p className='text-muted-foreground truncate text-xs'>{card.label}</p>
                <p className={`truncate text-base font-bold sm:text-lg ${card.colorClass}`}>
                  {card.prefix ?? ''}
                  {formatCurrency(Math.abs(card.value))}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
