'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { StatementReview } from '@/lib/statement-reconciliation';
import type { Account } from '@/types';
import { StatementReviewPanel } from './statement-review-panel';
export function StatementCurrencyReview({
  documentId,
  data,
  accounts,
}: {
  documentId: string;
  data: StatementReview;
  accounts: Account[];
}): React.ReactElement {
  const t = useTranslations('statementReconciliation');
  const currencies = [
    ...new Set(
      [...data.rows.map((row) => row.currency), ...(data.metadata?.currencies ?? [])].filter(
        (value): value is string => value === 'COP' || value === 'USD',
      ),
    ),
  ];
  const [selected, setSelected] = useState(
    currencies.includes('COP') ? 'COP' : (currencies[0] ?? 'COP'),
  );
  const scope =
    data.scopes?.find((entry) => entry.currency === selected) ??
    (accounts.find((a) => a.id === data.scope?.account_id)?.currency === selected
      ? data.scope
      : null);
  const rows = data.rows.filter(
    (row) =>
      row.currency === selected ||
      (!row.currency && selected === (currencies.includes('COP') ? 'COP' : currencies[0])),
  );
  const filtered = {
    ...data,
    scope,
    rows,
    proofs: data.proofs.filter((proof) => rows.some((row) => row.id === proof.observation_id)),
    transactions: scope
      ? data.transactions.filter(
          (tx) =>
            (tx.account_id === scope.account_id ||
              tx.transfer_to_account_id === scope.account_id) &&
            tx.date >= scope.period_start &&
            tx.date <= scope.period_end,
        )
      : [],
  };
  return (
    <div className='space-y-4'>
      {currencies.length > 1 && (
        <div role='group' aria-label={t('currencySections')} className='flex flex-wrap gap-2'>
          {currencies.map((currency) => (
            <Button
              key={currency}
              variant={selected === currency ? 'secondary' : 'outline'}
              aria-pressed={selected === currency}
              onClick={() => setSelected(currency)}>
              {currency} ·{' '}
              {
                data.rows.filter((row) => row.currency === currency && row.status !== 'rejected')
                  .length
              }
            </Button>
          ))}
        </div>
      )}
      <StatementReviewPanel
        key={selected}
        documentId={documentId}
        data={filtered}
        accounts={accounts}
        currency={selected}
      />
    </div>
  );
}
