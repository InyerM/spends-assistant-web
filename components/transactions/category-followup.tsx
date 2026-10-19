'use client';
import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { useCategoryFollowupStore } from '@/lib/stores/category-followup.store';
import { useCategoryFollowup } from '@/lib/api/queries/category-followup.queries';
import { useApplyCategoryFollowup } from '@/lib/api/mutations/category-followup.mutations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/shared/loader';
export function CategoryFollowup(): React.ReactElement | null {
  const { transactionId, clear } = useCategoryFollowupStore();
  const query = useCategoryFollowup(transactionId),
    apply = useApplyCategoryFollowup(transactionId);
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const t = useTranslations('categoryFollowup'),
    locale = useLocale();
  useEffect(() => {
    if (!transactionId || !query.data?.rows.length) return;
    const id = toast(t('offer', { name: query.data.contact_name, count: query.data.rows.length }), {
      duration: 12000,
      action: {
        label: t('review'),
        onClick: () => {
          setSelected([]);
          setOpen(true);
        },
      },
    });
    return (): void => {
      toast.dismiss(id);
    };
  }, [transactionId, query.data, t]);
  if (!query.data?.rows.length) return null;
  const data = query.data;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!apply.isPending) {
          setOpen(value);
          if (!value) clear();
        }
      }}>
      <DialogContent className='max-h-[85dvh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{t('title', { name: data.contact_name })}</DialogTitle>
          <DialogDescription>{t('hint', { category: data.category_name })}</DialogDescription>
        </DialogHeader>
        {data.rows.map((row) => (
          <label
            key={row.id}
            className='border-border flex items-start gap-3 border-t py-3 text-sm'>
            <Checkbox
              checked={selected.includes(row.id)}
              disabled={apply.isPending}
              onCheckedChange={(value) =>
                setSelected((current) =>
                  value === true ? [...current, row.id] : current.filter((id) => id !== row.id),
                )
              }
            />
            <span className='min-w-0 flex-1'>
              <span className='block break-words'>{row.description}</span>
              <span className='text-muted-foreground block text-xs'>
                {row.date} ·{' '}
                {new Intl.NumberFormat(locale, {
                  style: 'currency',
                  currency: row.currency,
                }).format(row.amount)}
              </span>
              <span className='text-muted-foreground text-xs'>
                {row.category_name ?? t('uncategorized')} → {data.category_name}
              </span>
            </span>
          </label>
        ))}
        {data.rows.length === 100 && <p className='text-muted-foreground text-xs'>{t('limit')}</p>}
        {apply.error && (
          <p role='alert' className='text-destructive text-sm'>
            {t('changed')}
          </p>
        )}
        <Button
          disabled={apply.isPending || !selected.length}
          onClick={() =>
            apply.mutate(
              {
                category_id: data.category_id,
                targets: data.rows
                  .filter((row) => selected.includes(row.id))
                  .map(({ id, category_id }) => ({ id, category_id })),
              },
              {
                onSuccess: () => {
                  setOpen(false);
                  clear();
                  toast.success(t('updated'));
                },
              },
            )
          }>
          {apply.isPending && <InlineLoader />}
          {t('apply', { count: selected.length })}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
