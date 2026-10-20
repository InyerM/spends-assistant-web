'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildCategoryItems } from '@/lib/utils/select-items';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { TransactionAnalysisError } from '@/lib/api/mutations/existing-transaction-review.mutations';
import type { ExpenseReviewRow, ExpenseReviewResult } from '@/types/expense-category-review';
import type { Category } from '@/types';
import type { Locale } from '@/i18n/config';
export function ExpenseCategoryReviewRow({
  row,
  categories,
  selected,
  disabled,
  selectionDisabled,
  analyzing,
  result,
  choice,
  onSelect,
  onChoice,
  onApply,
}: {
  row: ExpenseReviewRow;
  categories: Category[];
  selected: boolean;
  disabled: boolean;
  selectionDisabled?: boolean;
  analyzing: boolean;
  result?: ExpenseReviewResult;
  choice?: string;
  onSelect: () => void;
  onChoice: (id: string) => void;
  onApply: (id: string) => void;
}): React.ReactElement {
  const t = useTranslations('expenseCategoryReview'),
    locale = useLocale() as Locale;
  const current = categories.find((category) => category.id === row.category_id);
  const proposed =
    choice ?? (result?.proposal?.kind === 'expense' ? result.proposal.category_id : null) ?? '';
  return (
    <article
      className='border-border space-y-3 border-b py-4 last:border-b-0'
      aria-busy={analyzing}>
      <div className='flex items-start gap-3'>
        <Checkbox
          className='mt-1'
          checked={selected}
          disabled={disabled || selectionDisabled}
          onCheckedChange={onSelect}
          aria-label={t('selectFor', { description: row.description })}
        />
        <div className='min-w-0 flex-1'>
          <Link
            href={`/transactions/${row.id}`}
            target='_blank'
            className='text-sm font-medium break-words hover:underline'>
            {row.description}
          </Link>
          <p className='text-muted-foreground mt-1 text-xs'>
            {row.date} ·{' '}
            {new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: row.currency ?? 'COP',
            }).format(row.amount)}
          </p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('current', {
              category: current ? getCategoryName(current, locale) : t('uncategorized'),
            })}
          </p>
        </div>
        {analyzing && (
          <span className='text-ai flex items-center gap-2 text-xs' role='status'>
            <InlineLoader />
            {t('analyzing')}
          </span>
        )}
      </div>
      {result?.error instanceof AiConsentRequiredError ? (
        <AiConsentNotice scope={result.error.scope} />
      ) : result?.error ? (
        <p role='alert' className='text-warning pl-7 text-sm'>
          {t(
            result.error instanceof TransactionAnalysisError && result.error.status === 429
              ? 'quotaError'
              : 'analysisError',
          )}
        </p>
      ) : null}
      {result?.proposal && (
        <div className='bg-muted/30 space-y-3 rounded-lg p-3 sm:ml-7'>
          <p className='text-muted-foreground text-sm break-words'>{result.proposal.explanation}</p>
          {!result.proposal.category_id && (
            <p className='text-muted-foreground text-xs'>{t('noSuggestion')}</p>
          )}
          <div className='flex flex-col items-stretch gap-3 sm:flex-row sm:items-end'>
            <label className='min-w-0 flex-1 space-y-1 text-xs font-medium'>
              {t('proposed')}
              <SearchableSelect
                value={proposed}
                onValueChange={onChoice}
                disabled={disabled}
                ariaLabel={t('proposedFor', { description: row.description })}
                placeholder={t('chooseCategory')}
                searchPlaceholder={t('searchCategory')}
                emptyText={t('noCategories')}
                items={buildCategoryItems(categories, 'expense', {
                  locale,
                  allPrefix: (name) => name,
                })}
              />
            </label>
            <Button
              size='sm'
              variant='outline'
              disabled={disabled || !proposed || proposed === row.category_id}
              onClick={() => onApply(proposed)}
              aria-label={t('applyFor', { description: row.description })}>
              {proposed === row.category_id ? t('alreadyCorrect') : t('apply')}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
