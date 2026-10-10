'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { compareStatement, StatementTransaction } from '@/lib/statement-reconciliation';
export function StatementDifferences({
  comparison,
  transactions,
  account,
  busy,
  submit,
}: {
  comparison: ReturnType<typeof compareStatement>;
  transactions: StatementTransaction[];
  account: string;
  busy: boolean;
  submit: (body: Record<string, string>) => void;
}): React.ReactElement {
  const t = useTranslations('statementReconciliation'),
    locale = useLocale();
  const data = { transactions };
  const [selection, setSelection] = useState<Record<string, string>>({});
  const money = (amount: number | null, currency: string | null): string =>
    amount === null || !currency
      ? t('unknown')
      : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  return (
    <>
      {comparison.needsReview.length > 0 && (
        <section className='border-warning/30 bg-warning/5 space-y-2 rounded-xl border p-4'>
          <h5 className='text-warning text-sm font-semibold'>
            {t('unverifiedRows', { count: comparison.needsReview.length })}
          </h5>
          <p className='text-muted-foreground text-xs'>{t('unverifiedHint')}</p>
          {comparison.needsReview.map((row) => (
            <p key={row.id} className='text-sm'>
              {row.description} · {t('unknown')}
            </p>
          ))}
        </section>
      )}
      <div className='grid items-start gap-4 lg:grid-cols-2'>
        <div className='border-border min-w-0 space-y-3 rounded-xl border p-4'>
          <h5 className='font-semibold'>
            {t('statementOnly', { count: comparison.statementOnly.length })}
          </h5>
          <p className='text-muted-foreground text-xs'>{t('statementHint')}</p>
          {comparison.statementOnly.map((row) => {
            const ids = comparison.candidates[row.id] ?? [];
            const chosen = selection[row.id] ?? (ids.length === 1 ? ids[0] : '');
            return (
              <div key={row.id} className='border-border space-y-2 border-t pt-3'>
                <p className='text-sm font-medium break-words'>{row.description}</p>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <p className='text-muted-foreground text-xs'>
                    {row.occurred_at_text ?? t('unknown')}
                  </p>
                  <p
                    className={`text-sm font-semibold tabular-nums ${row.amount !== null && row.amount > 0 ? 'text-primary' : 'text-destructive'}`}>
                    {row.amount !== null && row.amount > 0 ? '+' : ''}
                    {money(row.amount, row.currency)}
                  </p>
                </div>
                {ids.length > 0 ? (
                  <>
                    <Select
                      value={chosen}
                      onValueChange={(value) =>
                        setSelection((current) => ({ ...current, [row.id]: value }))
                      }
                      disabled={busy}>
                      <SelectTrigger className='w-full min-w-0' aria-label={t('candidate')}>
                        <SelectValue placeholder={t('chooseCandidate')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ids.map((id) => {
                          const transaction = data.transactions.find((tx) => tx.id === id);
                          return (
                            <SelectItem key={id} value={id}>
                              {transaction?.date} · {transaction?.description}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className='text-muted-foreground text-xs'>
                      {t(ids.length > 1 ? 'ambiguous' : 'exactHint')}
                    </p>
                    <Button
                      size='sm'
                      disabled={busy || !chosen}
                      onClick={() =>
                        void submit({
                          action: 'confirm',
                          observation_id: row.id,
                          transaction_id: chosen,
                        })
                      }>
                      {t('confirm')}
                    </Button>
                  </>
                ) : (
                  <p className='text-muted-foreground text-xs'>
                    {t(row.amount === null || !row.occurred_at_text ? 'needsFields' : 'noMatch')}
                  </p>
                )}
              </div>
            );
          })}
          {comparison.statementOnly.length === 0 && (
            <p className='text-muted-foreground text-sm'>{t('none')}</p>
          )}
        </div>
        <div className='border-border min-w-0 space-y-3 rounded-xl border p-4'>
          <h5 className='font-semibold'>{t('appOnly', { count: comparison.appOnly.length })}</h5>
          <p className='text-muted-foreground text-xs'>{t('appHint')}</p>
          {comparison.appOnly.map((tx) => (
            <Link
              key={tx.id}
              href={`/transactions/${tx.id}`}
              className='border-border hover:bg-card-overlay block space-y-1 rounded-lg border p-3'>
              <p className='text-sm font-medium break-words'>{tx.description}</p>
              <p className='text-muted-foreground text-xs'>
                {tx.date} ·{' '}
                <span
                  className={
                    tx.type === 'income' ||
                    (tx.type === 'transfer' && tx.transfer_to_account_id === account)
                      ? 'text-primary'
                      : 'text-destructive'
                  }>
                  {money(
                    tx.type === 'income' ||
                      (tx.type === 'transfer' && tx.transfer_to_account_id === account)
                      ? tx.amount
                      : -tx.amount,
                    tx.currency,
                  )}
                </span>
              </p>
            </Link>
          ))}
          {comparison.appOnly.length === 0 && (
            <p className='text-muted-foreground text-sm'>{t('none')}</p>
          )}
        </div>
      </div>
    </>
  );
}
