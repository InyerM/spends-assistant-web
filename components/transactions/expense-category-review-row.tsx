'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineLoader } from '@/components/shared/loader';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { TransactionAnalysisError } from '@/lib/api/mutations/existing-transaction-review.mutations';
import { ExpenseReviewProposal } from './expense-review-proposal';
import type {
  ExpenseReviewChanges,
  ExpenseReviewRow,
  ExpenseReviewResult,
} from '@/types/expense-category-review';
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
  onApply: (changes: ExpenseReviewChanges) => void;
}): React.ReactElement {
  const t = useTranslations('expenseCategoryReview'),
    locale = useLocale() as Locale;
  const current = categories.find((category) => category.id === row.category_id);
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
        <ExpenseReviewProposal
          key={JSON.stringify(result.proposal)}
          row={row}
          proposal={result.proposal}
          categories={categories}
          choice={choice}
          disabled={disabled}
          onChoice={onChoice}
          onApply={onApply}
        />
      )}
    </article>
  );
}
