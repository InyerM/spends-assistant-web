'use client';
import { useCategories } from '@/lib/api/queries/category.queries';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Tags, ChevronRight, Sparkles } from 'lucide-react';
import { ExpenseCategoryReviewDialog } from './expense-category-review-dialog';
import { Button } from '@/components/ui/button';
import { useCategorySuggestions } from '@/lib/api/queries/category-followup.queries';
import { useCategoryFollowupStore } from '@/lib/stores/category-followup.store';
export function CategorySuggestions({
  contactId,
  onUncategorized,
}: {
  contactId?: string;
  onUncategorized?: () => void;
}): React.ReactElement {
  const t = useTranslations('categoryFollowup');
  const { data: categories } = useCategories();
  const locale = useLocale() as Locale;
  const query = useCategorySuggestions(contactId);
  const [expanded, setExpanded] = useState(false);
  const [aiReviewOpen, setAiReviewOpen] = useState(false);
  const tAi = useTranslations('expenseCategoryReview');
  const categoryName = (id: string, fallback: string): string => {
    const category = categories?.find((c) => c.id === id);
    return category ? getCategoryName(category, locale) : fallback;
  };
  const rows = query.data ?? [];
  const count = rows.reduce((total, row) => total + row.count, 0);
  return (
    <section className='border-border bg-card rounded-xl border px-4 py-3'>
      <div className='flex flex-wrap items-center gap-3'>
        <Tags className='text-success size-4 shrink-0' />
        <div className='min-w-0 flex-1'>
          <h3 className='text-sm font-medium'>{t('reviewTitle')}</h3>
          <p className='text-muted-foreground text-xs'>
            {query.isError ? t('queueError') : t(count ? 'queueCount' : 'queueEmpty', { count })}
          </p>
        </div>
        {onUncategorized && (
          <Button variant='ghost' size='sm' onClick={onUncategorized}>
            {t('showUncategorized')}
          </Button>
        )}
        {!contactId && (
          <Button variant='outline' size='sm' onClick={() => setAiReviewOpen(true)}>
            <Sparkles className='size-4' />
            {tAi('entry')}
          </Button>
        )}
        {rows.length > 0 && (
          <Button
            variant='outline'
            size='sm'
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}>
            {t('reviewSuggestions')}
            <ChevronRight className={`size-4 ${expanded ? 'rotate-90' : ''}`} />
          </Button>
        )}
      </div>
      {expanded && (
        <div className='divide-border mt-3 divide-y'>
          {rows.map((row) => (
            <div
              className='flex flex-wrap items-center gap-3 py-3'
              key={`${row.contact_id}:${row.category_id}`}>
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium break-words'>{row.contact_name}</p>
                <p className='text-muted-foreground text-xs'>
                  {t('queueSuggestion', {
                    count: row.count,
                    category: categoryName(row.category_id, row.category_name),
                  })}
                </p>
              </div>
              <Button
                size='sm'
                variant='outline'
                onClick={() => useCategoryFollowupStore.getState().offer(row.transaction_id, true)}>
                {t('review')}
              </Button>
            </div>
          ))}
        </div>
      )}
      {aiReviewOpen && <ExpenseCategoryReviewDialog open onOpenChange={setAiReviewOpen} />}
    </section>
  );
}
