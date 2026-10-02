'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DocumentBatchReviewHints } from '@/components/documents/document-batch-review-hints';
import { DocumentReviewFields } from '@/components/documents/document-review-fields';
import { suggestDocumentReview, type ReviewHistoryObservation } from '@/lib/document-review';
import type { DocumentSuggestionGroup } from '@/lib/api/queries/document.queries';
import type { Account, Category } from '@/types';
import type { DocumentReviewRow, useDocumentBatchReview } from '@/hooks/use-document-batch-review';

type ReviewController = ReturnType<typeof useDocumentBatchReview>;

interface Props {
  row: DocumentReviewRow;
  history: ReviewHistoryObservation[];
  accounts: Account[];
  categories: Category[];
  suggestions: DocumentSuggestionGroup[];
  review: ReviewController;
}

export function DocumentBatchReviewRow({
  row,
  history,
  accounts,
  categories,
  suggestions,
  review,
}: Props): React.ReactElement {
  const t = useTranslations('documents');
  const {
    drafts,
    selected,
    sharedCurrency,
    busy,
    errors,
    duplicates,
    expandedRowId,
    toggle,
    editRow,
    updateDraft,
    setMatchReview,
    setRejectTarget,
    hasCreatedTransaction,
  } = review;
  const draft = drafts[row.id];
  const suggestion = suggestDocumentReview(row, history, sharedCurrency);
  return (
    <article className='px-4 py-4 sm:px-5'>
      <div className='flex items-start gap-3'>
        <Checkbox
          className='mt-1 size-5 shrink-0'
          aria-label={t('selectObservation', { description: row.description })}
          checked={selected.includes(row.id)}
          disabled={busy}
          onCheckedChange={() => toggle(row)}
        />
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-1'>
            <div className='min-w-0'>
              <h5 className='text-sm font-semibold break-words sm:text-base'>{row.description}</h5>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                {row.occurred_at_text ?? t('dateUnknown')}
              </p>
            </div>
            <strong className='text-sm whitespace-nowrap tabular-nums sm:text-base'>
              {row.amount === null
                ? t('amountUnknown')
                : `${suggestion.currency?.value ?? row.currency ?? 'COP'} ${row.amount.toLocaleString()}`}
            </strong>
          </div>
          <DocumentBatchReviewHints
            row={row}
            suggestion={suggestion}
            accounts={accounts}
            categories={categories}
            suggestions={suggestions}
            review={review}
          />
          {errors[row.id] && (
            <p role='alert' className='text-destructive mt-2 text-xs'>
              {errors[row.id]}
            </p>
          )}
          {Object.hasOwn(duplicates, row.id) && (
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <Link
                className='text-primary text-xs underline'
                href={`/transactions/${duplicates[row.id].id}`}>
                {t('reviewExistingTransaction')}
              </Link>
              <Button
                size='xs'
                variant='outline'
                disabled={busy}
                onClick={() =>
                  setMatchReview({
                    row,
                    candidate: {
                      transaction_id: duplicates[row.id].id,
                      description: duplicates[row.id].description,
                      date: duplicates[row.id].date,
                      amount: duplicates[row.id].amount,
                    },
                  })
                }>
                {t('linkDuplicate', { description: duplicates[row.id].description })}
              </Button>
            </div>
          )}
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={busy}
              aria-expanded={expandedRowId === row.id}
              onClick={() => editRow(row)}>
              <Pencil className='size-4' aria-hidden='true' />
              {t('editObservation')}
            </Button>
            <Button
              size='sm'
              variant='ghost'
              className='text-destructive hover:bg-destructive/10 hover:text-destructive'
              disabled={busy}
              onClick={() => setRejectTarget([row])}>
              <Trash2 className='size-4' aria-hidden='true' />
              {t('reviewReject')}
            </Button>
          </div>
          {Object.hasOwn(drafts, row.id) && expandedRowId === row.id && (
            <div className='border-border bg-muted/20 mt-4 space-y-3 rounded-lg border p-3 sm:p-4'>
              <DocumentReviewFields
                draft={draft}
                accounts={accounts}
                categories={categories}
                disabled={busy || hasCreatedTransaction(row.id)}
                onChange={(patch) => updateDraft(row.id, patch)}
              />
              {draft.learned && (
                <p className='text-muted-foreground mt-2 text-xs'>{t('learnedSuggestion')}</p>
              )}
              <p className='text-muted-foreground text-xs break-words'>{row.source_excerpt}</p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
