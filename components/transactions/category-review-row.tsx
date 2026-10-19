'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildCategoryItems } from '@/lib/utils/select-items';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import { useExplainCategoryReview } from '@/lib/api/mutations/category-review.mutations';
import { AiConsentRequiredError } from '@/lib/ai-consent';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import type { CategoryFollowup } from '@/lib/api/queries/category-followup.queries';
import type { Category } from '@/types';
import type { Locale } from '@/i18n/config';
export interface ReviewDraft {
  category_id: string;
  description: string;
  notes: string | null;
}
export function CategoryReviewRow({
  sourceId,
  row,
  draft,
  categories,
  type,
  selected,
  busy,
  onSelect,
  onChange,
}: {
  sourceId: string;
  row: CategoryFollowup['rows'][number];
  draft: ReviewDraft;
  categories: Category[];
  type: 'expense' | 'income';
  selected: boolean;
  busy: boolean;
  onSelect: (selected: boolean) => void;
  onChange: (draft: ReviewDraft) => void;
}): React.ReactElement {
  const t = useTranslations('categoryFollowup'),
    locale = useLocale() as Locale;
  const [expanded, setExpanded] = useState(false);
  const ai = useExplainCategoryReview(sourceId);
  const name = (id: string | null): string => {
    const c = categories.find((c) => c.id === id);
    return c ? getCategoryName(c, locale) : t('uncategorized');
  };
  return (
    <div className='border-border space-y-3 border-t py-4'>
      <div className='flex items-start gap-3'>
        <Checkbox
          aria-label={t('selectMovement', { description: row.description })}
          checked={selected}
          disabled={busy}
          onCheckedChange={(value) => onSelect(value === true)}
        />
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-medium break-words'>{draft.description}</p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {row.date} ·{' '}
            {new Intl.NumberFormat(locale, {
              style: 'currency',
              currency: row.currency,
            }).format(row.amount)}
          </p>
          <p className='text-muted-foreground mt-1 text-xs'>
            {name(row.category_id)} →{' '}
            <span className='text-foreground'>{name(draft.category_id)}</span>
          </p>
        </div>
        <Button
          variant='ghost'
          size='sm'
          disabled={busy}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}>
          {t('editMovement')}
        </Button>
      </div>
      {expanded && (
        <div className='space-y-3 pl-7'>
          <label className='block space-y-1 text-sm'>
            {t('categoryLabel')}
            <SearchableSelect
              value={draft.category_id}
              onValueChange={(id) => onChange({ ...draft, category_id: id })}
              ariaLabel={t('categoryLabel')}
              disabled={busy}
              items={buildCategoryItems(categories, type, { locale, allPrefix: (name) => name })}
            />
          </label>
          <label className='block space-y-1 text-sm'>
            {t('descriptionLabel')}
            <Input
              value={draft.description}
              maxLength={500}
              disabled={busy}
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
            />
          </label>
          <label className='block space-y-1 text-sm'>
            {t('notesLabel')}
            <Textarea
              value={draft.notes ?? ''}
              maxLength={1500}
              disabled={busy}
              onChange={(e) => onChange({ ...draft, notes: e.target.value })}
            />
          </label>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              size='sm'
              variant='ai'
              disabled={busy || ai.isPending}
              onClick={() =>
                ai.mutate({
                  locale,
                  target_id: row.id,
                  description: draft.description,
                  notes: draft.notes ?? '',
                })
              }>
              <Sparkles className='size-4' />
              {t(ai.isPending ? 'analyzingContext' : 'reviewWithAi')}
            </Button>
            <Link
              href={`/transactions/${row.id}`}
              className='text-muted-foreground text-xs underline'>
              {t('viewOriginal')}
            </Link>
          </div>
          {ai.data && (
            <div className='bg-muted/40 space-y-2 rounded-lg p-3 text-sm'>
              <p className='font-medium'>
                {ai.data.category_id ? name(ai.data.category_id) : t('categoryNeedsReview')}
              </p>
              <p>{ai.data.explanation}</p>
              <p className='text-muted-foreground'>{ai.data.description}</p>
              {ai.data.notes && (
                <p className='text-muted-foreground wrap-anywhere whitespace-pre-wrap'>
                  {ai.data.notes}
                </p>
              )}
              <Button
                size='sm'
                variant='outline'
                disabled={busy || ai.data.kind === 'own_transfer'}
                onClick={() =>
                  onChange({
                    category_id: ai.data.category_id ?? draft.category_id,
                    description: ai.data.description,
                    notes: ai.data.notes,
                  })
                }>
                {t('useProposal')}
              </Button>
            </div>
          )}
          {ai.error instanceof AiConsentRequiredError ? (
            <AiConsentNotice scope={ai.error.scope} />
          ) : (
            ai.error && (
              <p role='status' className='text-muted-foreground text-xs'>
                {t('explanationUnavailable')}
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
