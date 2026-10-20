'use client';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { InlineLoader } from '@/components/shared/loader';
import { CheckCheck, FileX2, ListChecks } from 'lucide-react';
import {
  useDocumentReviewStatus,
  type DocumentReviewStatus,
} from '@/lib/api/mutations/document-review-status.mutations';
import type { StoredDocument } from '@/lib/api/queries/document.queries';
export function DocumentReviewStatusControl({
  document,
  disabled,
}: {
  document: StoredDocument;
  disabled: boolean;
}): React.ReactElement {
  const t = useTranslations('documentWorkflow'),
    save = useDocumentReviewStatus(document.id);
  return (
    <div className='space-y-2 border-t pt-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-muted-foreground text-xs'>{t('label')}</span>
        <Select
          value={document.review_status ?? 'active'}
          disabled={disabled || save.isPending || document.status !== 'extracted'}
          onValueChange={(value) => save.mutate(value as DocumentReviewStatus)}>
          <SelectTrigger className='w-full sm:w-48' aria-label={t('label')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='active'>
              <ListChecks className='size-4' />
              {t('active')}
            </SelectItem>
            <SelectItem value='completed'>
              <CheckCheck className='size-4' />
              {t('completed')}
            </SelectItem>
            <SelectItem
              value='no_movements'
              disabled={document.document_observations.some(
                (row) =>
                  ['created', 'reconciled'].includes(row.status) || !!row.match_transaction_id,
              )}>
              <FileX2 className='size-4' />
              {t('no_movements')}
            </SelectItem>
          </SelectContent>
        </Select>
        {save.isPending && <InlineLoader />}
        {document.review_status && document.review_status !== 'active' && (
          <span className='text-muted-foreground text-xs'>{t('doesNotReplaceProof')}</span>
        )}
      </div>
      {save.isError && (
        <p role='alert' className='text-destructive text-xs'>
          {t('saveError')}
        </p>
      )}
    </div>
  );
}
