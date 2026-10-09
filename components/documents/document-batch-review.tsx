'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DocumentAccountSelect } from '@/components/documents/document-review-selects';
import { DocumentRejectDialog } from '@/components/documents/document-reject-dialog';
import { DocumentBulkReconciliation } from '@/components/documents/document-bulk-reconciliation';
import { DocumentBatchReviewRow } from '@/components/documents/document-batch-review-row';
import { useDocumentBatchReview } from '@/hooks/use-document-batch-review';
import type { DocumentReviewRow } from '@/hooks/use-document-batch-review';
import type { DocumentSuggestionGroup } from '@/lib/api/queries/document.queries';
import type { ReviewHistoryObservation } from '@/lib/document-review';
import type { Account, Category } from '@/types';

export type { DocumentReviewRow } from '@/hooks/use-document-batch-review';

interface Props {
  documentId: string;
  rows: DocumentReviewRow[];
  history: ReviewHistoryObservation[];
  accounts: Account[];
  categories: Category[];
  onRefresh: () => Promise<void>;
  suggestions?: DocumentSuggestionGroup[];
}

export function DocumentBatchReview({
  documentId,
  rows,
  history,
  accounts,
  categories,
  onRefresh,
  suggestions = [],
}: Props): React.ReactElement | null {
  const t = useTranslations('documents');
  const [reconciling, setReconciling] = useState(false);
  const review = useDocumentBatchReview({
    documentId,
    rows,
    history,
    accounts,
    categories,
    onRefresh,
    suggestions,
  });
  const {
    pending,
    chosen,
    selected,
    bulkAccount,
    confirmed,
    setConfirmed,
    rejectTarget,
    setRejectTarget,
    matchReview,
    setMatchReview,
    busy: posting,
    progress,
    activeAccounts,
    selectAll,
    selectAccount,
    approve,
    rejectRows,
    linkExisting,
  } = review;

  const busy = posting || reconciling;

  if (pending.length === 0) return null;

  return (
    <section className='space-y-3' aria-label={t('batchReview')}>
      <DocumentBulkReconciliation
        documentId={documentId}
        rows={rows}
        suggestions={suggestions}
        onRefresh={onRefresh}
        disabled={posting}
        onBusyChange={setReconciling}
      />
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h4 className='text-sm font-semibold'>{t('pendingGroup', { count: pending.length })}</h4>
          <p className='text-muted-foreground text-xs'>{t('batchHint')}</p>
        </div>
        <Button
          size='sm'
          variant='outline'
          disabled={busy}
          onClick={selectAll}
          aria-label={t('selectAllPending')}>
          {pending.every((row) => selected.includes(row.id))
            ? t('clearSelection')
            : t('selectAllPending')}
        </Button>
      </div>
      <div className='border-border bg-card divide-y rounded-xl border'>
        {pending.map((row) => (
          <DocumentBatchReviewRow
            key={row.id}
            row={row}
            history={history}
            accounts={accounts}
            categories={categories}
            suggestions={suggestions}
            review={{ ...review, busy }}
          />
        ))}
      </div>
      {chosen.length > 0 && (
        <div className='border-brand-secondary/25 bg-card space-y-3 rounded-lg border p-4'>
          <p className='text-brand-secondary font-semibold'>
            {t('selectedCount', { count: chosen.length })}
          </p>
          <div className='space-y-1 text-sm'>
            <label>{t('bulkAccount')}</label>
            <DocumentAccountSelect
              value={bulkAccount}
              accounts={activeAccounts}
              disabled={busy}
              label={t('bulkAccount')}
              onChange={selectAccount}
            />
          </div>
          <p className='text-muted-foreground text-xs'>{t('batchReviewWarning')}</p>
          <label className='flex items-start gap-2 text-sm'>
            <Checkbox
              className='mt-1'
              aria-label={t('confirmSelected')}
              checked={confirmed}
              disabled={busy}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            {t('confirmSelected')}
          </label>
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' disabled={busy || !confirmed} onClick={() => void approve()}>
              <Check className='size-4' aria-hidden='true' />
              {t('approveSelected')}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              className='text-destructive hover:bg-destructive/10 hover:text-destructive'
              disabled={busy}
              onClick={() => setRejectTarget(chosen)}>
              {t('rejectSelected')}
            </Button>
          </div>
        </div>
      )}
      {rejectTarget && (
        <DocumentRejectDialog
          key={rejectTarget.map((row) => row.id).join(':')}
          count={rejectTarget.length}
          busy={busy}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason, detail) => void rejectRows(rejectTarget, reason, detail)}
        />
      )}
      {matchReview && (
        <div
          role='region'
          aria-label={t('reviewDecision')}
          className='border-brand-secondary/25 bg-card space-y-2 rounded-lg border p-4'>
          <p className='text-brand-secondary font-semibold'>{t('reviewDecision')}</p>
          <p className='text-muted-foreground text-sm'>{t('confirmMatchSummary')}</p>
          <p className='text-sm'>
            {matchReview.candidate.description} · {matchReview.candidate.date} ·{' '}
            {matchReview.candidate.amount.toLocaleString()}
          </p>
          <div className='flex gap-2'>
            <Button size='sm' disabled={busy} onClick={() => void linkExisting()}>
              {t('confirmMatch')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={busy}
              onClick={() => setMatchReview(null)}>
              {t('cancelReview')}
            </Button>
          </div>
        </div>
      )}
      {progress && (
        <p role='status' className='text-muted-foreground text-sm'>
          {progress}
        </p>
      )}
    </section>
  );
}
