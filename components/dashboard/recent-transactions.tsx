'use client';

import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { formatTimeForDisplay } from '@/lib/utils/date';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';
import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft, ArrowRight } from 'lucide-react';
import type { TransactionType } from '@/types';

const typeConfig: Record<TransactionType, { icon: typeof ArrowDownLeft; colorClass: string }> = {
  expense: { icon: ArrowUpRight, colorClass: 'text-destructive' },
  income: { icon: ArrowDownLeft, colorClass: 'text-success' },
  transfer: { icon: ArrowRightLeft, colorClass: 'text-transfer' },
};

export function RecentTransactions(): React.ReactElement {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const { openWith } = useTransactionFormStore();
  const { data: result, isLoading } = useTransactions({ limit: 5 });
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();

  const getCategory = (
    categoryId: string | null,
  ): { name: string; color: string | null } | null => {
    if (!categoryId || !categories) return null;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return null;
    return { name: getCategoryName(cat, locale as Locale), color: cat.color };
  };

  const getAccountName = (accountId: string): string => {
    if (!accounts) return '';
    return accounts.find((a) => a.id === accountId)?.name ?? '';
  };

  if (isLoading) {
    return (
      <Card className='border-border bg-card'>
        <CardHeader>
          <Skeleton className='h-5 w-40' />
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
    <Card className='border-border bg-card overflow-hidden'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base font-medium'>{t('recentTransactions')}</CardTitle>
      </CardHeader>
      <CardContent className='min-w-0'>
        {transactions.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>{t('noTransactions')}</p>
        ) : (
          <>
            <div className='space-y-1'>
              {transactions.map((tx) => {
                const config = typeConfig[tx.type];
                const Icon = config.icon;
                const category = getCategory(tx.category_id);
                const accountName = getAccountName(tx.account_id);

                return (
                  <button
                    key={tx.id}
                    type='button'
                    onClick={(): void => openWith(tx)}
                    className='hover:bg-card-overlay flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg p-2.5 text-left'>
                    <div
                      className={`bg-card-overlay flex h-9 w-9 items-center justify-center rounded-full ${config.colorClass}`}>
                      <Icon className='h-4 w-4' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='text-foreground truncate text-sm font-medium'>
                        {tx.description}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>{accountName}</p>
                      {category && (
                        <Badge
                          variant='secondary'
                          className='mt-0.5 h-5 max-w-full truncate px-1.5 text-[10px]'
                          style={
                            category.color
                              ? {
                                  backgroundColor: `${category.color}20`,
                                  color: category.color,
                                }
                              : undefined
                          }>
                          {category.name}
                        </Badge>
                      )}
                    </div>
                    <div className='shrink-0 text-right'>
                      <p className={`text-sm font-semibold whitespace-nowrap ${config.colorClass}`}>
                        {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                        {formatCurrency(tx.amount, 'COP', locale)}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {formatTimeForDisplay(tx.time)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={(): void => router.push('/transactions')}
              className='text-muted-foreground hover:text-foreground hover:bg-card-overlay mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-sm transition-colors'>
              {t('viewAllTransactions')}
              <ArrowRight className='h-3.5 w-3.5' />
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
