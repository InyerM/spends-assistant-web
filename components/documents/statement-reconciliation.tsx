'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { DocumentAccountSelect } from '@/components/documents/document-review-selects';
import { PeriodSelector } from '@/components/transactions/period-selector';
import { InlineLoader } from '@/components/shared/loader';
import { compareStatement, type StatementReview } from '@/lib/statement-reconciliation';
import { StatementInspector } from '@/components/documents/statement-inspector';
import type { StatementHints } from '@/lib/statement-hints';
import type { Account } from '@/types';

export function StatementReconciliation({
  documentId,
  accounts,
}: {
  documentId: string;
  accounts: Account[];
}): React.ReactElement {
  const t = useTranslations('statementReconciliation');
  const query = useQuery({
    queryKey: ['documents', documentId, 'reconciliation'],
    queryFn: async (): Promise<StatementReview> => {
      const response = await fetch(`/api/documents/${documentId}/reconciliation`);
      if (!response.ok) throw new Error('Could not load reconciliation');
      return response.json() as Promise<StatementReview>;
    },
  });
  if (query.isPending) return <InlineLoader />;
  if (query.isError)
    return (
      <div role='alert' className='space-y-2'>
        <p>{t('loadError')}</p>
        <Button variant='outline' onClick={() => void query.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  return <StatementReviewPanel documentId={documentId} data={query.data} accounts={accounts} />;
}

function StatementReviewPanel({
  documentId,
  data,
  accounts,
}: {
  documentId: string;
  data: StatementReview;
  accounts: Account[];
}): React.ReactElement {
  const t = useTranslations('statementReconciliation');
  const locale = useLocale();
  const client = useQueryClient();
  const [account, setAccount] = useState(data.scope?.account_id ?? '');
  const [from, setFrom] = useState(data.scope?.period_start ?? '');
  const [to, setTo] = useState(data.scope?.period_end ?? '');
  const applyHints = useCallback((hints: StatementHints): void => {
    setAccount((current) => current || hints.account_id || '');
    setFrom((current) => current || hints.period_start || '');
    setTo((current) => current || hints.period_end || '');
  }, []);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const comparison = compareStatement(
    data.rows,
    data.transactions,
    data.proofs,
    data.scope?.account_id ?? '',
  );
  const hasLinks = data.proofs.length > 0;
  const scopeChanged =
    !data.scope ||
    account !== data.scope.account_id ||
    from !== data.scope.period_start ||
    to !== data.scope.period_end;
  const money = (amount: number | null, currency: string | null): string =>
    amount === null || !currency
      ? t('unknown')
      : new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  async function submit(body: Record<string, string>): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/documents/${documentId}/reconciliation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Reconciliation failed');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['documents'] }),
        client.invalidateQueries({ queryKey: ['transactions'] }),
      ]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className='space-y-5' aria-label={t('title')}>
      <div>
        <h4 className='font-semibold'>{t('title')}</h4>
        <p className='text-muted-foreground mt-1 text-sm'>{t('intro')}</p>
      </div>
      <StatementInspector documentId={documentId} onHints={applyHints} />
      <div className='bg-card-overlay grid gap-3 rounded-xl p-4 sm:grid-cols-2'>
        <div className='space-y-1'>
          <p className='text-sm font-medium'>{t('account')}</p>
          <DocumentAccountSelect
            value={account}
            accounts={accounts.filter((a) => a.is_active)}
            label={t('account')}
            disabled={busy || hasLinks}
            onChange={setAccount}
          />
        </div>
        <div className='min-w-0 space-y-1'>
          <p className='text-sm font-medium'>{t('period')}</p>
          <div className={busy || hasLinks ? 'pointer-events-none opacity-60' : ''}>
            <PeriodSelector
              dateFrom={from}
              dateTo={to}
              emptyLabel={t('choosePeriod')}
              onChange={(start, end) => {
                setFrom(start);
                setTo(end);
              }}
            />
          </div>
        </div>
        <p className='text-muted-foreground text-xs sm:col-span-2'>{t('periodHint')}</p>
        {!hasLinks && (
          <Button
            className='sm:col-span-2'
            disabled={busy || !account || !from || !to || !scopeChanged}
            onClick={() =>
              void submit({
                action: 'scope',
                account_id: account,
                period_start: from,
                period_end: to,
              })
            }>
            {t('compare')}
          </Button>
        )}
        {hasLinks && (
          <p className='text-muted-foreground text-xs sm:col-span-2'>{t('lockedScope')}</p>
        )}
      </div>
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {t('saveError')}
        </p>
      )}
      {busy && (
        <p role='status' className='text-muted-foreground flex items-center gap-2 text-sm'>
          <InlineLoader />
          {t('saving')}
        </p>
      )}
      {data.scope && !scopeChanged && (
        <>
          <div role='status' className='flex flex-wrap gap-2'>
            <Badge className='bg-primary/10 text-primary'>
              {t('matched', { count: data.proofs.filter((p) => p.valid).length })}
            </Badge>
            <Badge variant='outline' className='border-warning/30 text-warning'>
              {t('statementOnly', { count: comparison.statementOnly.length })}
            </Badge>
            <Badge variant='outline' className='border-warning/30 text-warning'>
              {t('appOnly', { count: comparison.appOnly.length })}
            </Badge>
          </div>
          {data.proofs.map((proof) => (
            <div
              key={proof.id}
              className='border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3'>
              <Link
                className={
                  proof.valid
                    ? 'text-primary flex items-center gap-2 text-sm'
                    : 'text-warning flex items-center gap-2 text-sm'
                }
                href={`/transactions/${proof.transaction_id}`}>
                {proof.valid ? (
                  <CheckCheck className='size-4' />
                ) : (
                  <AlertTriangle className='size-4' />
                )}
                {t(proof.valid ? 'reconciled' : 'changed')} ·{' '}
                {data.rows.find((r) => r.id === proof.observation_id)?.description}
              </Link>
              <Button
                size='sm'
                variant='outline'
                disabled={busy}
                onClick={() => void submit({ action: 'undo', link_id: proof.id ?? '' })}>
                {t('undo')}
              </Button>
            </div>
          ))}
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
                    <p className='text-muted-foreground text-xs'>
                      {row.occurred_at_text ?? t('unknown')} · {money(row.amount, row.currency)}
                    </p>
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
                        {t(
                          row.amount === null || !row.occurred_at_text ? 'needsFields' : 'noMatch',
                        )}
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
              <h5 className='font-semibold'>
                {t('appOnly', { count: comparison.appOnly.length })}
              </h5>
              <p className='text-muted-foreground text-xs'>{t('appHint')}</p>
              {comparison.appOnly.map((tx) => (
                <Link
                  key={tx.id}
                  href={`/transactions/${tx.id}`}
                  className='border-border hover:bg-card-overlay block space-y-1 rounded-lg border p-3'>
                  <p className='text-sm font-medium break-words'>{tx.description}</p>
                  <p className='text-muted-foreground text-xs'>
                    {tx.date} · {money(tx.amount, tx.currency)}
                  </p>
                </Link>
              ))}
              {comparison.appOnly.length === 0 && (
                <p className='text-muted-foreground text-sm'>{t('none')}</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
