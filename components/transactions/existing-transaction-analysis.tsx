'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { InlineLoader } from '@/components/shared/loader';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { useExistingTransactionAnalysis } from '@/hooks/use-existing-transaction-analysis';
import type { ReviewMetadataField } from '@/lib/transactions/existing-ai-review';
import type { Category } from '@/types';
import type { Locale } from '@/i18n/config';
export function ExistingTransactionAnalysis({
  analysis,
  categories,
  disabled,
}: {
  analysis: ReturnType<typeof useExistingTransactionAnalysis>;
  categories: Category[];
  disabled: boolean;
}): React.ReactElement {
  const t = useTranslations('transactions'),
    locale = useLocale();
  const { mutation, snapshot, selected, setSelected } = analysis;
  function label(field: ReviewMetadataField, value: string | null | undefined): string {
    if (field === 'category_id') {
      const category = categories.find((c) => c.id === value);
      return category ? getCategoryName(category, locale as Locale) : t('noCategory');
    }
    return value || t('emptyReviewValue');
  }
  const fields: ReviewMetadataField[] = ['description', 'category_id', 'notes'];
  const changes =
    mutation.data && snapshot
      ? fields.filter(
          (field) => mutation.data[field] !== null && mutation.data[field] !== snapshot[field],
        )
      : [];
  return (
    <section className='border-border space-y-3 rounded-lg border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-muted-foreground text-xs'>{t('existingAnalysisHint')}</p>
        <Button
          type='button'
          variant='ai'
          size='sm'
          disabled={disabled || mutation.isPending}
          onClick={analysis.run}>
          {mutation.isPending ? <InlineLoader /> : <Sparkles className='size-4' />}
          {t(mutation.isPending ? 'existingAnalyzing' : 'analyzeExisting')}
        </Button>
      </div>
      {mutation.error instanceof AiConsentRequiredError ? (
        <AiConsentNotice scope={mutation.error.scope} />
      ) : mutation.error ? (
        <p role='alert' className='text-warning text-xs'>
          {t('existingAnalysisFailed')}
        </p>
      ) : null}
      {mutation.data && snapshot && (
        <div className='space-y-3'>
          <p className='text-sm'>{mutation.data.explanation}</p>
          {changes.map((field) => (
            <label
              key={field}
              className='bg-muted/30 flex items-start gap-2 rounded-md p-2 text-sm'>
              <Checkbox
                disabled={disabled}
                checked={selected.includes(field)}
                onCheckedChange={(checked) =>
                  setSelected((ids) =>
                    checked ? [...ids, field] : ids.filter((id) => id !== field),
                  )
                }
              />
              <span className='min-w-0 flex-1'>
                <span className='font-medium'>
                  {t(field === 'category_id' ? 'category' : field)}
                </span>
                <span className='text-muted-foreground mt-1 line-clamp-3 block text-xs break-words'>
                  {label(field, snapshot[field])}
                </span>
                <span className='text-success mt-1 line-clamp-4 block text-xs break-words'>
                  → {label(field, mutation.data[field])}
                </span>
              </span>
            </label>
          ))}
          {!changes.length && (
            <p className='text-muted-foreground text-xs'>{t('existingNoChanges')}</p>
          )}
          {changes.length > 0 && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={disabled || !selected.length || analysis.reviewed}
              onClick={analysis.apply}>
              {t('applyReviewedSuggestions')}
            </Button>
          )}
          {analysis.reviewed && (
            <p role='status' className='text-muted-foreground text-xs'>
              {t('existingSuggestionsApplied')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
