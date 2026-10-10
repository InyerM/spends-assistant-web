'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import { TransactionOrigin } from '@/components/transactions/transaction-origin';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowDownLeft, ArrowRightLeft, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTransaction } from '@/lib/api/queries/transaction.queries';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import { formatCurrency } from '@/lib/utils/formatting';
import type { Locale } from '@/i18n/config';

export default function TransactionDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('transactions');
  const locale = useLocale();
  const { openWith } = useTransactionFormStore();
  const { data: transaction, isLoading, isError } = useTransaction(id);
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const account = accounts?.find((item) => item.id === transaction?.account_id);
  const category = categories?.find((item) => item.id === transaction?.category_id);
  const Icon =
    transaction?.type === 'income'
      ? ArrowDownLeft
      : transaction?.type === 'transfer'
        ? ArrowRightLeft
        : ArrowUpRight;

  return (
    <main className='mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8'>
      <Link
        href='/transactions'
        className='text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm'>
        <ArrowLeft aria-hidden='true' className='h-4 w-4' />
        {t('title')}
      </Link>
      {isLoading ? (
        <p className='text-muted-foreground'>{t('loading')}</p>
      ) : isError || !transaction ? (
        <p role='alert' className='text-destructive'>
          {t('notFound')}
        </p>
      ) : (
        <Card>
          <CardHeader className='gap-3'>
            <div className='flex justify-end'>
              <Button variant='outline' onClick={() => openWith(transaction)}>
                {t('editTransaction')}
              </Button>
            </div>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div className='flex min-w-0 items-start gap-3'>
                <span className='bg-muted rounded-lg p-2'>
                  <Icon aria-hidden='true' className='h-5 w-5' />
                </span>
                <div className='min-w-0'>
                  <CardTitle className='text-2xl tracking-tight wrap-anywhere'>
                    {transaction.description}
                  </CardTitle>
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {transaction.date} · {transaction.time}
                  </p>
                </div>
              </div>
              <strong className='shrink-0 text-lg tabular-nums'>
                {formatCurrency(transaction.amount, account?.currency ?? 'COP', locale)}
              </strong>
            </div>
          </CardHeader>
          <CardContent>
            <TransactionOrigin transactionId={id} />
            <dl className='border-border grid gap-4 border-t pt-4 text-sm sm:grid-cols-2'>
              <div>
                <dt className='text-muted-foreground'>{t('type')}</dt>
                <dd>{t(transaction.type)}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('account')}</dt>
                <dd>{account?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('category')}</dt>
                <dd>{category ? getCategoryName(category, locale as Locale) : '—'}</dd>
              </div>
              <div>
                <dt className='text-muted-foreground'>{t('source')}</dt>
                <dd>{transaction.source}</dd>
              </div>
              {transaction.notes && (
                <div className='sm:col-span-2'>
                  <dt className='text-muted-foreground'>{t('notes')}</dt>
                  <dd>{transaction.notes}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
