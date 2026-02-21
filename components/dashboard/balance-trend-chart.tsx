'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { Transaction } from '@/types';

interface DayPoint {
  date: string;
  label: string;
  balance: number;
}

interface BalanceTrendChartProps {
  transactions: Transaction[];
  dateFrom: string;
  dateTo: string;
  className?: string;
}

interface BalanceTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  locale: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  locale,
}: BalanceTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const value = payload[0].value ?? 0;
  return (
    <div className='bg-popover border-border rounded-lg border p-2 text-xs shadow-md'>
      <p className='text-muted-foreground mb-0.5'>{label}</p>
      <p className={`font-semibold ${value >= 0 ? 'text-success' : 'text-destructive'}`}>
        {formatCurrency(value, 'COP', locale)}
      </p>
    </div>
  );
}

function formatYAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export function BalanceTrendChart({
  transactions,
  dateFrom,
  dateTo,
  className,
}: BalanceTrendChartProps): React.ReactElement | null {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const { data: accounts, isLoading: accLoading } = useAccounts();

  const { chartData, endBalance } = useMemo(() => {
    if (!accounts) return { chartData: [], endBalance: 0 };

    const currentBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

    // Build daily net map from transactions (income - expense)
    const dailyNet = new Map<string, number>();
    for (const tx of transactions) {
      const existing = dailyNet.get(tx.date) ?? 0;
      if (tx.type === 'income') dailyNet.set(tx.date, existing + tx.amount);
      else if (tx.type === 'expense') dailyNet.set(tx.date, existing - tx.amount);
      // transfers don't change total balance
    }

    const start = new Date(dateFrom + 'T00:00:00');
    const end = new Date(dateTo + 'T00:00:00');

    // Total net change for the period
    let periodNet = 0;
    for (const [, net] of dailyNet) {
      periodNet += net;
    }

    // Starting balance = current balance minus net of all period transactions
    const startBalance = currentBalance - periodNet;

    const days: DayPoint[] = [];
    let runningBalance = startBalance;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const dayNet = dailyNet.get(key) ?? 0;
      runningBalance += dayNet;
      const dayNum = d.getDate();
      const month = d.getMonth() + 1;
      days.push({ date: key, label: `${month}/${dayNum}`, balance: runningBalance });
    }

    return { chartData: days, endBalance: runningBalance };
  }, [transactions, accounts, dateFrom, dateTo]);

  if (accLoading) {
    return (
      <Card className={`border-border bg-card flex flex-col ${className ?? ''}`}>
        <CardContent className='p-4 sm:p-5'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='mt-1 h-3 w-56' />
          <Skeleton className='mt-3 h-8 w-36' />
          <Skeleton className='mt-3 h-[200px] w-full rounded-lg' />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) return null;

  const isPositive = endBalance >= 0;

  return (
    <Card className={`border-border bg-card flex flex-col ${className ?? ''}`}>
      <CardContent className='flex flex-1 flex-col p-4 sm:p-5'>
        <h3 className='text-foreground text-base font-semibold'>{t('balanceTrend')}</h3>
        <p className='text-muted-foreground mt-0.5 text-xs'>{t('balanceTrendSubtitle')}</p>

        <p
          className={`mt-3 text-xl font-bold sm:text-2xl ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {formatCurrency(endBalance, 'COP', locale)}
        </p>

        <div className='mt-3 min-h-[200px] w-full flex-1'>
          <ResponsiveContainer width='100%' height='100%'>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id='balanceGradient' x1='0' y1='0' x2='0' y2='1'>
                  <stop offset='5%' stopColor='#3b82f6' stopOpacity={0.3} />
                  <stop offset='95%' stopColor='#3b82f6' stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey='label'
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval='preserveStartEnd'
                className='fill-muted-foreground'
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={50}
                className='fill-muted-foreground'
              />
              <Tooltip
                content={
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ((props: any) => <CustomTooltip {...props} locale={locale} />) as any
                }
              />
              <ReferenceLine
                y={0}
                stroke='hsl(var(--muted-foreground))'
                strokeDasharray='3 3'
                strokeOpacity={0.3}
              />
              <Area
                type='monotone'
                dataKey='balance'
                stroke='#3b82f6'
                strokeWidth={2}
                fill='url(#balanceGradient)'
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
