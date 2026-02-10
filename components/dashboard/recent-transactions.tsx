'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { formatDateForDisplay, formatTimeForDisplay } from '@/lib/utils/date';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react';
import type { TransactionType } from '@/types';

const typeConfig: Record<
  TransactionType,
  { icon: typeof ArrowDownLeft; colorClass: string; label: string }
> = {
  expense: { icon: ArrowUpRight, colorClass: 'text-destructive', label: 'Expense' },
  income: { icon: ArrowDownLeft, colorClass: 'text-success', label: 'Income' },
  transfer: { icon: ArrowRightLeft, colorClass: 'text-transfer', label: 'Transfer' },
};

export function RecentTransactions(): React.ReactElement {
  const { data: result, isLoading } = useTransactions({ limit: 15 });
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  const getCategoryName = (categoryId: string | null): string | null => {
    if (!categoryId || !categories) return null;
    return categories.find((c) => c.id === categoryId)?.name ?? null;
  };

  const getAccountName = (accountId: string): string => {
    if (!accounts) return '';
    return accounts.find((a) => a.id === accountId)?.name ?? '';
  };

  if (isLoading) {
    return (
      <Card className='border-border bg-card'>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex items-center gap-4'>
              <Skeleton className='h-10 w-10 rounded-full' />
              <div className='flex-1 space-y-2'>
                <Skeleton className='h-4 w-48' />
                <Skeleton className='h-3 w-32' />
              </div>
              <Skeleton className='h-5 w-24' />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const transactions = result?.data ?? [];

  return (
    <Card className='border-border bg-card'>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>No transactions yet</p>
        ) : (
          <div className='space-y-3'>
            {transactions.map((tx) => {
              const config = typeConfig[tx.type];
              const Icon = config.icon;
              const categoryName = getCategoryName(tx.category_id);
              const accountName = getAccountName(tx.account_id);

              return (
                <div
                  key={tx.id}
                  className='hover:bg-card-overlay flex items-center gap-3 rounded-lg p-2'>
                  <div
                    className={`bg-card-overlay flex h-10 w-10 items-center justify-center rounded-full ${config.colorClass}`}>
                    <Icon className='h-5 w-5' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-foreground truncate text-sm font-medium'>{tx.description}</p>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                      <span>{formatDateForDisplay(tx.date)}</span>
                      <span>{formatTimeForDisplay(tx.time)}</span>
                      {categoryName && (
                        <Badge variant='secondary' className='text-xs'>
                          {categoryName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className='text-right'>
                    <p className={`text-sm font-semibold ${config.colorClass}`}>
                      {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                      {formatCurrency(tx.amount)}
                    </p>
                    <p className='text-muted-foreground text-xs'>{accountName}</p>
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
