'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useTransactions } from '@/lib/api/queries/transaction.queries';
import { formatCurrency } from '@/lib/utils/formatting';
import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';
import type { Account } from '@/types';
export function AccountRecords({ account }: { account: Account }): React.ReactElement {
  const t = useTranslations('accounts'),
    locale = useLocale();
  const query = useTransactions({ account_id: account.id, limit: 10 });
  const rows = query.data?.data ?? [];
  return (
    <section className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-semibold'>{t('recentMovements')}</h3>
        <Link className='text-success text-sm' href={`/transactions?account_id=${account.id}`}>
          {t('viewAllMovements')}
        </Link>
      </div>
      {query.isLoading ? (
        <p className='text-muted-foreground text-sm'>{t('loadingActivity')}</p>
      ) : rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('noTransactionsForAccount')}</p>
      ) : (
        <div className='divide-border divide-y'>
          {rows.map((tx) => {
            const Icon =
              tx.type === 'expense'
                ? ArrowUpRight
                : tx.type === 'income'
                  ? ArrowDownLeft
                  : ArrowRightLeft;
            return (
              <Link
                key={tx.id}
                href={`/transactions/${tx.id}`}
                className='hover:bg-muted/30 flex flex-wrap items-center gap-3 rounded-lg py-3'>
                <Icon className='text-muted-foreground size-4 shrink-0' />
                <div className='min-w-0 flex-1'>
                  <p className='truncate text-sm'>{tx.description}</p>
                  <p className='text-muted-foreground text-xs'>
                    {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                      new Date(`${tx.date}T12:00:00`),
                    )}
                  </p>
                </div>
                <span
                  className={`max-w-full text-sm font-medium wrap-anywhere tabular-nums ${tx.type === 'income' ? 'text-success' : tx.type === 'expense' ? 'text-warning' : 'text-foreground'}`}>
                  {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                  {formatCurrency(tx.amount, account.currency, locale)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
