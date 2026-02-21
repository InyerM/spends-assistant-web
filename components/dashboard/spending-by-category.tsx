'use client';

import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCategories } from '@/lib/api/queries/category.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import { ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { Locale } from '@/i18n/config';
import type { Transaction } from '@/types';

const CHART_COLORS = [
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#f97316',
];

const MAX_VISIBLE = 5;

interface SpendingByCategoryProps {
  transactions: Transaction[];
  isLoading?: boolean;
}

interface CategorySpending {
  id: string;
  name: string;
  amount: number;
  color: string;
}

interface CategoryTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: CategorySpending; value?: number }>;
  locale: string;
}

function CustomTooltip({
  active,
  payload,
  locale,
}: CategoryTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className='bg-popover border-border rounded-lg border p-2 text-xs shadow-md'>
      <p className='text-foreground mb-0.5 font-medium'>{entry.payload?.name}</p>
      <p className='text-muted-foreground'>{formatCurrency(entry.value ?? 0, 'COP', locale)}</p>
    </div>
  );
}

export function SpendingByCategory({
  transactions,
  isLoading,
}: SpendingByCategoryProps): React.ReactElement {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();

  const { data: categories, isLoading: catLoading } = useCategories();

  const expenses = transactions.filter((tx) => tx.type === 'expense');
  const spending: CategorySpending[] = [];

  if (expenses.length > 0 && categories) {
    const byCategory = new Map<string, number>();
    for (const tx of expenses) {
      const catId = tx.category_id ?? 'uncategorized';
      byCategory.set(catId, (byCategory.get(catId) ?? 0) + tx.amount);
    }

    let colorIndex = 0;
    for (const [catId, amount] of byCategory) {
      const cat = categories.find((c) => c.id === catId);
      spending.push({
        id: catId,
        name: cat ? getCategoryName(cat, locale as Locale) : 'Uncategorized',
        amount,
        color: CHART_COLORS[colorIndex % CHART_COLORS.length],
      });
      colorIndex++;
    }

    spending.sort((a, b) => b.amount - a.amount);
  }

  const totalSpending = spending.reduce((sum, s) => sum + s.amount, 0);
  const visibleSpending = spending.slice(0, MAX_VISIBLE);
  const hasMore = spending.length > MAX_VISIBLE;

  if (isLoading || catLoading) {
    return (
      <Card className='border-border bg-card'>
        <CardHeader className='pb-3'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='mt-2 h-8 w-36' />
        </CardHeader>
        <CardContent className='space-y-5'>
          {Array.from({ length: MAX_VISIBLE }).map((_, i) => (
            <div key={i} className='flex items-center gap-3'>
              <Skeleton className='h-3 w-24 shrink-0' />
              <Skeleton
                className='h-4 flex-1 rounded-full'
                style={{ maxWidth: `${90 - i * 15}%` }}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='border-border bg-card flex flex-col overflow-hidden'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base font-medium'>{t('spendingByCategory')}</CardTitle>
        <p className='text-destructive text-2xl font-bold'>
          -{formatCurrency(totalSpending, 'COP', locale)}
        </p>
      </CardHeader>
      <CardContent className='flex min-w-0 flex-1 flex-col'>
        {spending.length === 0 ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('noExpensesThisMonth')}
          </p>
        ) : (
          <>
            <div className='w-full' style={{ height: visibleSpending.length * 40 + 10 }}>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart
                  layout='vertical'
                  data={visibleSpending}
                  margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                  <YAxis
                    dataKey='name'
                    type='category'
                    width={130}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className='fill-muted-foreground'
                    tickFormatter={(name: string): string =>
                      name.length > 16 ? name.slice(0, 16) + '…' : name
                    }
                  />
                  <XAxis type='number' hide />
                  <Tooltip
                    content={
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      ((props: any) => <CustomTooltip {...props} locale={locale} />) as any
                    }
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                  />
                  <Bar dataKey='amount' radius={[0, 4, 4, 0]} barSize={16}>
                    {visibleSpending.map((cat) => (
                      // eslint-disable-next-line @typescript-eslint/no-deprecated
                      <Cell key={cat.id} fill={cat.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {hasMore && (
              <button
                onClick={(): void => router.push('/transactions?type=expense')}
                className='text-muted-foreground hover:text-foreground mt-4 flex w-full cursor-pointer items-center justify-center gap-1.5 py-2.5 text-sm transition-colors'>
                {t('viewAllCategories')}
                <ArrowRight className='h-3.5 w-3.5' />
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
