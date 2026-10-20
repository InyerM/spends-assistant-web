'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRightLeft, LoaderCircle } from 'lucide-react';
import { useTransaction } from '@/lib/api/queries/transaction.queries';
import { useStatementFundingCorrection } from '@/lib/api/mutations/statement-funding-correction.mutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils/formatting';
import type { Transaction } from '@/types';
export function StatementFundingCorrection({
  transaction,
}: {
  transaction: Transaction;
}): React.ReactElement | null {
  if (
    transaction.type !== 'transfer' ||
    transaction.source !== 'statement' ||
    transaction.currency !== 'COP' ||
    transaction.source_currency !== 'USD' ||
    !transaction.destination_amount
  )
    return null;
  return <FundingCorrectionPanel transaction={transaction} />;
}
function FundingCorrectionPanel({
  transaction: original,
}: {
  transaction: Transaction;
}): React.ReactElement {
  const latest = useTransaction(original.id);
  const transaction = latest.data ?? original;
  const t = useTranslations('statementFundingCorrection');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const correction = useStatementFundingCorrection(transaction.id);
  const actual = Number(amount);
  return (
    <section className='border-border min-w-0 space-y-3 rounded-lg border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='flex items-center gap-2 text-sm font-medium'>
          <ArrowRightLeft className='size-4 shrink-0' />
          {formatCurrency(transaction.amount, 'COP', locale)} →{' '}
          {formatCurrency(
            transaction.destination_amount ?? original.destination_amount ?? 0,
            'USD',
            locale,
          )}
        </p>
        <Button
          variant='ghost'
          size='sm'
          aria-expanded={open}
          disabled={correction.isPending}
          onClick={(): void => {
            setOpen(!open);
            setAmount(String(transaction.amount));
            correction.reset();
          }}>
          {t('review')}
        </Button>
      </div>
      {open && (
        <div className='space-y-3'>
          <p className='text-muted-foreground text-xs'>{t('help')}</p>
          <Label htmlFor={`funding-actual-${transaction.id}`}>{t('actual')}</Label>
          <Input
            id={`funding-actual-${transaction.id}`}
            type='number'
            inputMode='decimal'
            min='0.01'
            step='0.01'
            value={amount}
            disabled={correction.isPending}
            onChange={(event): void => {
              setAmount(event.target.value);
              correction.reset();
            }}
          />
          {correction.isError && (
            <p role='alert' className='text-destructive text-xs'>
              {t(
                correction.error.message === 'FUNDING_DUPLICATE'
                  ? 'duplicate'
                  : correction.error.message === 'FUNDING_ALREADY_RECONCILED'
                    ? 'reconciled'
                    : 'error',
              )}
            </p>
          )}
          <div className='flex justify-end'>
            <Button
              size='sm'
              disabled={
                correction.isPending ||
                !Number.isFinite(actual) ||
                actual <= 0 ||
                actual === transaction.amount
              }
              onClick={(): void => {
                correction.mutate(
                  { expected_amount: transaction.amount, actual_amount: actual },
                  { onSuccess: (): void => setOpen(false) },
                );
              }}>
              {correction.isPending && <LoaderCircle className='size-4 animate-spin' />}
              {t('confirm')}
            </Button>
          </div>
        </div>
      )}
      {correction.isSuccess && (
        <p role='status' className='text-success text-xs'>
          {t('saved')}
        </p>
      )}
    </section>
  );
}
