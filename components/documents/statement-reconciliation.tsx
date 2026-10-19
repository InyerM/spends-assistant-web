'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useStatementReconciliation } from '@/lib/api/queries/statement.queries';
import { useSaveStatementReconciliation } from '@/lib/api/mutations/statement.mutations';
import { useTranslations } from 'next-intl';
import { CheckCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatementDifferences } from '@/components/documents/statement-differences';
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
  const query = useStatementReconciliation(documentId);
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
  const save = useSaveStatementReconciliation(documentId);
  const [account, setAccount] = useState(data.scope?.account_id ?? '');
  const [from, setFrom] = useState(data.scope?.period_start ?? '');
  const [to, setTo] = useState(data.scope?.period_end ?? '');
  const applyHints = useCallback((hints: StatementHints): void => {
    setAccount((current) => current || hints.account_id || '');
    setFrom((current) => current || hints.period_start || '');
    setTo((current) => current || hints.period_end || '');
  }, []);
  const busy = save.isPending,
    error = save.error;
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
  function submit(body: Record<string, string>): void {
    save.mutate(body);
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
            <Badge className='bg-success/10 text-success'>
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
                    ? 'text-success flex items-center gap-2 text-sm'
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
          <StatementDifferences
            documentId={documentId}
            accounts={accounts}
            comparison={comparison}
            transactions={data.transactions}
            account={account}
            busy={busy}
            submit={submit}
          />
        </>
      )}
    </section>
  );
}
