'use client';
import { AiFieldStatus } from '@/components/shared/ai-field-status';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildCategoryItems } from '@/lib/utils/select-items';
import type { ExpenseReviewChanges, ExpenseReviewRow } from '@/types/expense-category-review';
import type { CategoryReview } from '@/lib/category-review';
import type { Category } from '@/types';
import type { Locale } from '@/i18n/config';
export function ExpenseReviewProposal({
  row,
  proposal,
  categories,
  choice,
  disabled,
  onChoice,
  onApply,
}: {
  row: ExpenseReviewRow;
  proposal: CategoryReview;
  categories: Category[];
  choice?: string;
  disabled: boolean;
  onChoice: (id: string) => void;
  onApply: (changes: ExpenseReviewChanges) => void;
}): React.ReactElement {
  const t = useTranslations('expenseCategoryReview'),
    locale = useLocale() as Locale;
  const proposed = choice ?? (proposal.kind === 'expense' ? proposal.category_id : null) ?? '';
  const [description, setDescription] = useState(proposal.description);
  const [notes, setNotes] = useState(proposal.notes);
  const [included, setIncluded] = useState({
    description: proposal.description !== row.description,
    notes: proposal.notes !== (row.notes ?? ''),
    category: Boolean(proposed && proposed !== row.category_id),
  });
  const changes: ExpenseReviewChanges = {};
  if (included.description && description.trim() && description.trim() !== row.description)
    changes.description = description.trim();
  if (included.notes && notes !== (row.notes ?? '')) changes.notes = notes || null;
  if (included.category && proposed && proposed !== row.category_id) changes.category_id = proposed;
  const invalid = included.description && !description.trim();
  return (
    <div className='bg-muted/30 space-y-4 rounded-lg p-3 sm:ml-7'>
      <p className='text-muted-foreground text-sm break-words'>{proposal.explanation}</p>
      <div className='ai-field space-y-2' data-ai-state='suggested'>
        <div className='flex flex-wrap items-center gap-2'>
          <Checkbox
            checked={included.description}
            disabled={disabled}
            aria-label={t('applyDescription')}
            onCheckedChange={(value): void =>
              setIncluded((prev) => ({ ...prev, description: value === true }))
            }
          />
          <Label htmlFor={`review-description-${row.id}`}>{t('descriptionField')}</Label>
          <span className='ml-auto'>
            <AiFieldStatus />
          </span>
        </div>
        <Input
          id={`review-description-${row.id}`}
          value={description}
          maxLength={500}
          disabled={disabled}
          onChange={(event): void => {
            setDescription(event.target.value);
            setIncluded((prev) => ({ ...prev, description: true }));
          }}
        />
      </div>
      <div className='ai-field space-y-2' data-ai-state='suggested'>
        <div className='flex flex-wrap items-center gap-2'>
          <Checkbox
            checked={included.notes}
            disabled={disabled}
            aria-label={t('applyNotes')}
            onCheckedChange={(value): void =>
              setIncluded((prev) => ({ ...prev, notes: value === true }))
            }
          />
          <Label htmlFor={`review-notes-${row.id}`}>{t('notesField')}</Label>
          <span className='ml-auto'>
            <AiFieldStatus />
          </span>
        </div>
        {row.notes && (
          <p className='text-muted-foreground text-xs break-words'>
            {t('originalNotes', { notes: row.notes })}
          </p>
        )}
        <Textarea
          id={`review-notes-${row.id}`}
          value={notes}
          maxLength={1500}
          rows={2}
          disabled={disabled}
          onChange={(event): void => {
            setNotes(event.target.value);
            setIncluded((prev) => ({ ...prev, notes: true }));
          }}
        />
      </div>
      <div className='ai-field space-y-2' data-ai-state='suggested'>
        <div className='flex flex-wrap items-center gap-2'>
          <Checkbox
            checked={included.category}
            disabled={disabled || !proposed}
            aria-label={t('applyCategory')}
            onCheckedChange={(value): void =>
              setIncluded((prev) => ({ ...prev, category: value === true }))
            }
          />
          <span className='text-sm font-medium'>{t('proposed')}</span>
          <span className='ml-auto'>
            <AiFieldStatus />
          </span>
        </div>
        <SearchableSelect
          value={proposed}
          onValueChange={(value): void => {
            onChoice(value);
            setIncluded((prev) => ({ ...prev, category: true }));
          }}
          disabled={disabled}
          ariaLabel={t('proposedFor', { description: row.description })}
          placeholder={t('chooseCategory')}
          searchPlaceholder={t('searchCategory')}
          emptyText={t('noCategories')}
          items={buildCategoryItems(categories, 'expense', { locale, allPrefix: (name) => name })}
        />
        {!proposal.category_id && (
          <p className='text-muted-foreground text-xs'>{t('noSuggestion')}</p>
        )}
      </div>
      <div className='flex justify-end'>
        <Button
          size='sm'
          variant='outline'
          disabled={disabled || invalid || !Object.keys(changes).length}
          onClick={(): void => onApply(changes)}
          aria-label={t('applyFor', { description: row.description })}>
          {t(Object.keys(changes).length ? 'apply' : 'noChanges')}
        </Button>
      </div>
    </div>
  );
}
