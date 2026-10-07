'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { inferAccountFromEvidence, type suggestDocumentReview } from '@/lib/document-review';
import type { DocumentSuggestionGroup } from '@/lib/api/queries/document.queries';
import type { Account, Category } from '@/types';
import type {
  DocumentReviewRow,
  ReviewDraft,
  UseDocumentBatchReviewResult,
} from '@/hooks/use-document-batch-review';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';

interface Props {
  row: DocumentReviewRow;
  suggestion: ReturnType<typeof suggestDocumentReview>;
  accounts: Account[];
  categories: Category[];
  suggestions: DocumentSuggestionGroup[];
  review: UseDocumentBatchReviewResult;
}

export function DocumentBatchReviewHints({
  row,
  suggestion,
  accounts,
  categories,
  suggestions,
  review,
}: Props): React.ReactElement {
  const t = useTranslations('documents');
  const locale = useLocale() as Locale;
  const {
    selected,
    drafts,
    busy,
    aiBusy,
    aiHints,
    updateDraft,
    suggestCategoryWithAi,
    setMatchReview,
  } = review;
  const draft = drafts[row.id];
  const reviewHint = suggestions.find((group) => group.observation_id === row.id);
  const proposedCategory = reviewHint?.category_suggestion;
  const historicalCategory =
    proposedCategory &&
    (row.amount === null ||
      (row.amount > 0 ? proposedCategory.type === 'income' : proposedCategory.type !== 'income')) &&
    categories.some(
      (category) =>
        category.id === proposedCategory.categoryId &&
        category.is_active &&
        category.type === proposedCategory.type,
    )
      ? proposedCategory
      : null;
  const accountEvidence = inferAccountFromEvidence(row.source_excerpt, accounts);
  const evidencedAccountName = accounts.find(
    (account) => account.id === accountEvidence?.accountId,
  )?.name;
  const historicalCategoryRecord = categories.find(
    (category) => category.id === historicalCategory?.categoryId,
  );
  return (
    <>
      {suggestion.currency && (
        <p className='mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300'>
          <AlertCircle className='size-3.5' aria-hidden='true' />
          {t('currencySuggestion', { currency: suggestion.currency.value })}
        </p>
      )}
      {evidencedAccountName && (
        <p className='text-muted-foreground mt-1 text-xs'>
          {t('accountEvidenceHint', { name: evidencedAccountName })}
        </p>
      )}
      {suggestion.previouslyRejected && (
        <p className='mt-1 text-xs text-amber-700 dark:text-amber-300'>
          {t('previouslyRejectedHint')}
        </p>
      )}
      {reviewHint?.candidates.map((candidate) => (
        <div
          key={candidate.transaction_id}
          className='mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs'>
          <p className='text-foreground min-w-0'>
            {t('possibleDuplicate', {
              description: candidate.description,
              date: candidate.date,
            })}
          </p>
          <div className='flex items-center gap-2'>
            <Link
              className='text-brand font-medium underline underline-offset-2'
              href={`/transactions/${candidate.transaction_id}`}>
              {t('reviewExistingTransaction')}
            </Link>
            <Button
              size='xs'
              variant='outline'
              disabled={busy}
              onClick={() => setMatchReview({ row, candidate })}>
              {t('reviewMatch')}
            </Button>
          </div>
        </div>
      ))}
      {historicalCategory && (
        <div className='mt-2 flex flex-wrap items-center gap-2'>
          <p className='text-muted-foreground text-xs'>
            {t('categoryHistoryHint', {
              name: historicalCategoryRecord
                ? getCategoryName(historicalCategoryRecord, locale)
                : t('selectCategory'),
              count: historicalCategory.evidenceCount,
            })}
          </p>
          {selected.includes(row.id) && draft.categoryId !== historicalCategory.categoryId && (
            <Button
              size='sm'
              variant='outline'
              disabled={busy}
              onClick={() =>
                updateDraft(row.id, {
                  categoryId: historicalCategory.categoryId,
                  type: historicalCategory.type as ReviewDraft['type'],
                })
              }>
              {t('applyCategorySuggestion')}
            </Button>
          )}
        </div>
      )}
      {selected.includes(row.id) && draft.type === 'expense' && draft.currency === 'COP' && (
        <div className='mt-2 flex flex-wrap items-center gap-2'>
          <Button
            size='sm'
            variant='ai'
            disabled={busy || !!aiBusy}
            onClick={() => void suggestCategoryWithAi(row)}>
            {aiBusy === row.id ? t('suggestingCategoryWithAi') : t('suggestCategoryWithAi')}
          </Button>
          {aiHints[row.id] && (
            <p className='text-muted-foreground text-xs'>
              {t('aiCategoryHint', { name: aiHints[row.id] })}
            </p>
          )}
        </div>
      )}
    </>
  );
}
