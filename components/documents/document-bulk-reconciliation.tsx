'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useDocumentBulkReconciliation } from '@/hooks/use-document-bulk-reconciliation';
import type { BulkReconciliationRow } from '@/lib/document-bulk-reconciliation';
import type { DocumentSuggestionGroup } from '@/lib/api/queries/document.queries';

export function DocumentBulkReconciliation(props: {
  documentId: string;
  rows: BulkReconciliationRow[];
  suggestions: DocumentSuggestionGroup[];
  onRefresh: () => Promise<void>;
  disabled: boolean;
  onBusyChange?: (busy: boolean) => void;
}): React.ReactElement | null {
  const t = useTranslations('documents');
  const locale = useLocale();
  const review = useDocumentBulkReconciliation(props);
  if (review.eligible.length === 0 && review.completed === 0 && review.failed === 0) return null;
  return (
    <div className='border-border bg-card space-y-3 rounded-lg border p-4'>
      <p className='text-muted-foreground text-xs'>{t('bulkReconcileHint')}</p>
      {review.preview ? (
        <div role='region' aria-label={t('reviewDecision')} className='space-y-3'>
          <p className='text-sm'>{t('bulkReconcileWarning')}</p>
          <ul className='space-y-2 text-sm'>
            {review.preview.map((match) => (
              <li key={match.observationId}>
                <a
                  className='underline'
                  href={`/transactions/${encodeURIComponent(match.candidate.transaction_id)}`}
                  target='_blank'
                  rel='noreferrer'>
                  {match.candidate.description} · {match.candidate.date} ·{' '}
                  {match.candidate.amount.toLocaleString(locale)} {match.candidate.currency} ·{' '}
                  {match.candidate.account_name}
                </a>
              </li>
            ))}
          </ul>
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              disabled={props.disabled || review.busy || review.eligible.length === 0}
              onClick={() => void review.confirm()}>
              {t('bulkReconcileConfirm', { count: review.preview.length })}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={review.busy}
              onClick={review.closePreview}>
              {t('cancelReview')}
            </Button>
          </div>
        </div>
      ) : review.eligible.length > 0 ? (
        <Button
          size='sm'
          variant='outline'
          disabled={props.disabled || review.busy}
          onClick={review.openPreview}>
          {t('bulkReconcile', { count: review.eligible.length })}
        </Button>
      ) : null}
      {(review.completed > 0 || review.failed > 0) && (
        <p role='status' className='text-muted-foreground text-sm'>
          {t('bulkReconcileResult', { completed: review.completed, failed: review.failed })}
        </p>
      )}
      {review.refreshFailed && (
        <p role='alert' className='text-destructive text-sm'>
          {t('bulkReconcileRefreshError')}
        </p>
      )}
    </div>
  );
}
