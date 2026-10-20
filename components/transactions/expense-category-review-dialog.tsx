'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineLoader } from '@/components/shared/loader';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useExpenseCategoryReview } from '@/hooks/use-expense-category-review';
import { ExpenseCategoryReviewRow } from './expense-category-review-row';
export function ExpenseCategoryReviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const t = useTranslations('expenseCategoryReview'),
    review = useExpenseCategoryReview(),
    categories = useCategories();
  const [search, setSearch] = useState('');
  const rows = review.queue.data?.data ?? [],
    count = review.queue.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / 10));
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!review.busy) onOpenChange(value);
      }}>
      <DialogContent
        className='flex max-h-[88dvh] flex-col gap-4 overflow-hidden sm:max-w-3xl'
        showCloseButton={!review.busy}
        onEscapeKeyDown={(event) => {
          if (review.busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (review.busy) event.preventDefault();
        }}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-3'>
          <Tabs
            value={review.filters.scope}
            onValueChange={(scope) =>
              review.changeFilters({ scope: scope as 'uncategorized' | 'all' })
            }>
            <TabsList className='w-full sm:w-fit'>
              <TabsTrigger value='uncategorized' disabled={review.busy}>
                {t('uncategorized')}
              </TabsTrigger>
              <TabsTrigger value='all' disabled={review.busy}>
                {t('allExpenses')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <form
            className='flex gap-2'
            onSubmit={(event) => {
              event.preventDefault();
              review.changeFilters({ search });
            }}>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={100}
              disabled={review.busy}
              placeholder={t('search')}
              aria-label={t('search')}
            />
            <Button
              variant='outline'
              size='icon'
              type='submit'
              disabled={review.busy}
              aria-label={t('searchAction')}>
              <Search className='size-4' />
            </Button>
          </form>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-muted-foreground text-xs'>
              {t('count', { count })} · {t('allPeriods')}
            </p>
            <Button
              size='sm'
              disabled={review.busy || !review.selected.length || review.queue.isFetching}
              onClick={review.analyze}>
              {review.analysis.isPending ? <InlineLoader /> : <Sparkles className='size-4' />}
              {t(review.analysis.isPending ? 'analyzing' : 'analyzeSelected', {
                count: review.selected.length,
              })}
            </Button>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-muted-foreground text-xs'>{t('batchHint')}</p>
            <Button
              variant='ghost'
              size='sm'
              disabled={review.busy || !rows.length}
              onClick={() => {
                if (review.selected.length) review.selected.forEach(review.toggle);
                else rows.slice(0, 5).forEach((row) => review.toggle(row.id));
              }}>
              {t(review.selected.length ? 'clearSelection' : 'selectBatch')}
            </Button>
          </div>
        </div>
        <div className='min-h-0 overflow-y-auto pr-1' aria-live='polite'>
          {review.queue.isPending ? (
            <div className='flex justify-center py-10'>
              <InlineLoader />
            </div>
          ) : review.queue.isError ? (
            <div role='alert' className='space-y-2 py-6 text-sm'>
              <p>{t('loadError')}</p>
              <Button size='sm' onClick={() => void review.queue.refetch()}>
                {t('retry')}
              </Button>
            </div>
          ) : !rows.length ? (
            <p className='text-muted-foreground py-10 text-center text-sm'>{t('empty')}</p>
          ) : (
            rows.map((row) => (
              <ExpenseCategoryReviewRow
                key={row.id}
                row={row}
                categories={categories.data ?? []}
                selected={review.selected.includes(row.id)}
                disabled={review.busy}
                selectionDisabled={!review.selected.includes(row.id) && review.selected.length >= 5}
                analyzing={review.analysis.isPending && review.selected.includes(row.id)}
                result={review.reviews[row.id]}
                choice={review.choices[row.id]}
                onSelect={() => review.toggle(row.id)}
                onChoice={(value) => review.setChoice(row.id, value)}
                onApply={(value) => review.apply(row, value)}
              />
            ))
          )}
        </div>
        {review.save.isError && (
          <p role='alert' className='text-destructive text-sm'>
            {t('saveError')}
          </p>
        )}
        {review.save.isPending && (
          <p role='status' className='flex items-center gap-2 text-sm'>
            <InlineLoader />
            {t('saving')}
          </p>
        )}
        <div className='border-border flex items-center justify-between border-t pt-3'>
          <span className='text-muted-foreground text-xs'>
            {t('page', { page: review.filters.page, pages })}
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='icon'
              disabled={review.busy || review.filters.page <= 1}
              aria-label={t('previous')}
              onClick={() => review.changeFilters({ page: review.filters.page - 1 })}>
              <ChevronLeft className='size-4' />
            </Button>
            <Button
              variant='outline'
              size='icon'
              disabled={review.busy || review.filters.page >= pages}
              aria-label={t('next')}
              onClick={() => review.changeFilters({ page: review.filters.page + 1 })}>
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
