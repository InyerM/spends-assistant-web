'use client';
import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useCategoryFollowupStore } from '@/lib/stores/category-followup.store';
import { useCategoryFollowup } from '@/lib/api/queries/category-followup.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CategoryReviewEditor } from './category-review-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
export function CategoryFollowup(): React.ReactElement | null {
  const busy = useIsMutating({ mutationKey: ['category-review'] }) > 0;
  const { transactionId, revision, direct, clear } = useCategoryFollowupStore();
  const query = useCategoryFollowup(transactionId, revision),
    categories = useCategories();
  const [open, setOpen] = useState(false);
  const t = useTranslations('categoryFollowup');
  useEffect(() => {
    if (!transactionId || !query.data?.rows.length || direct) return;
    const id = toast(t('offer', { name: query.data.contact_name, count: query.data.rows.length }), {
      duration: 12000,
      action: { label: t('review'), onClick: () => setOpen(true) },
    });
    return (): void => {
      toast.dismiss(id);
    };
  }, [transactionId, revision, direct, query.data, t]);
  if (!transactionId) return null;
  const data = query.data
    ? {
        ...query.data,
        rows: direct
          ? query.data.rows.filter((r) => r.is_uncategorized ?? !r.category_id)
          : query.data.rows,
      }
    : null;
  return (
    <Dialog
      open={direct || open}
      onOpenChange={(value) => {
        if (!busy) {
          setOpen(value);
          if (!value) clear();
        }
      }}>
      <DialogContent
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        className='max-h-[85dvh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>
            {data ? t('title', { name: data.contact_name }) : t('reviewTitle')}
          </DialogTitle>
          <DialogDescription>{t('reviewInstructions')}</DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <Skeleton className='h-40 w-full' />
        ) : query.error ? (
          <div>
            <p role='alert'>{t('explanationUnavailable')}</p>
            <Button onClick={() => void query.refetch()}>{t('retry')}</Button>
          </div>
        ) : data?.rows.length ? (
          <CategoryReviewEditor
            key={`${transactionId}:${revision}`}
            sourceId={transactionId}
            data={data}
            categories={categories.data ?? []}
            onComplete={() => {
              setOpen(false);
              clear();
              toast.success(t('updated'));
            }}
          />
        ) : (
          <p className='text-muted-foreground text-sm'>{t('nothingToReview')}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
