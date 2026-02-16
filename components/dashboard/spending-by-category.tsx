'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { formatCurrency } from '@/lib/utils/formatting';

const BAR_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-red-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-orange-500',
];

interface SpendingByCategoryProps {
  year: number;
  month: number;
}

interface CategorySpending {
  id: string;
  name: string;
  amount: number;
  color: string;
}

export function SpendingByCategory({ year, month }: SpendingByCategoryProps): React.ReactElement {
  const t = useTranslations('dashboard');
  const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: result, isLoading: txLoading } = useTransactions({
    type: 'expense',
    date_from: dateFrom,
    date_to: dateTo,
    limit: 500,
  });
  const { data: categories, isLoading: catLoading } = useCategories();

  const transactions = result?.data ?? [];
  const spending: CategorySpending[] = [];

  if (transactions.length > 0 && categories) {
    const byCategory = new Map<string, number>();
    for (const tx of transactions) {
      const catId = tx.category_id ?? 'uncategorized';
      byCategory.set(catId, (byCategory.get(catId) ?? 0) + tx.amount);
    }

    let colorIndex = 0;
    for (const [catId, amount] of byCategory) {
      const cat = categories.find((c) => c.id === catId);
      spending.push({
        id: catId,
        name: cat?.name ?? 'Uncategorized',
        amount,
        color: BAR_COLORS[colorIndex % BAR_COLORS.length],
      });
      colorIndex++;
    }

    spending.sort((a, b) => b.amount - a.amount);
  }

  const totalSpending = spending.reduce((sum, s) => sum + s.amount, 0);

  if (txLoading || catLoading) {
    return (
      <Card className='border-border bg-card'>
        <CardHeader>
          <Skeleton className='h-5 w-40' />
        </CardHeader>
        <CardContent className='space-y-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-8 w-full' />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='border-border bg-card overflow-hidden'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base font-medium'>{t('spendingByCategory')}</CardTitle>
        <p className='text-destructive text-2xl font-bold'>-{formatCurrency(totalSpending)}</p>
      </CardHeader>
      <CardContent className='min-w-0'>
        {spending.length === 0 ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {t('noExpensesThisMonth')}
          </p>
        ) : (
          <div className='space-y-4'>
            {spending.slice(0, 8).map((cat) => {
              const percentage = totalSpending > 0 ? (cat.amount / totalSpending) * 100 : 0;
              return (
                <div key={cat.id}>
                  <div className='mb-1.5 flex items-center justify-between gap-2 text-sm'>
                    <span className='text-foreground min-w-0 truncate'>{cat.name}</span>
                    <span className='text-muted-foreground shrink-0'>
                      {formatCurrency(cat.amount)}
                    </span>
                  </div>
                  <div className='bg-muted h-2 overflow-hidden rounded-full'>
                    <div
                      className={`h-full rounded-full ${cat.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
