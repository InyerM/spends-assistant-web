'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildCategoryItems } from '@/lib/utils/select-items';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useBulkUpdateTransactions } from '@/lib/api/mutations/transaction.mutations';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: Set<string>;
  onComplete: () => void;
}

const UNCHANGED = '__unchanged__';
const NONE = '__none__';

export function BulkEditDialog({
  open,
  onOpenChange,
  selectedIds,
  onComplete,
}: BulkEditDialogProps): React.ReactElement {
  const t = useTranslations('transactions');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data: categories } = useCategories();
  const bulkMutation = useBulkUpdateTransactions();

  const [categoryId, setCategoryId] = useState(UNCHANGED);
  const hasChanges = categoryId !== UNCHANGED;

  const handleSubmit = async (): Promise<void> => {
    const updates: Record<string, unknown> = {};
    if (categoryId !== UNCHANGED) updates.category_id = categoryId === NONE ? null : categoryId;

    try {
      await bulkMutation.mutateAsync({
        ids: Array.from(selectedIds),
        updates,
      });
      toast.success(t('transactionsUpdated', { count: selectedIds.size }));
      onOpenChange(false);
      onComplete();
    } catch {
      toast.error(t('failedToBulkUpdate'));
    }
  };

  const handleOpenChange = (o: boolean): void => {
    if (!o) {
      setCategoryId(UNCHANGED);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='border-border bg-card max-h-[85dvh] overflow-y-auto sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{t('bulkEditTitle', { count: selectedIds.size })}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>{t('bulkEditDescription')}</p>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>{t('category')}</label>
            <SearchableSelect
              value={categoryId}
              onValueChange={setCategoryId}
              placeholder={tCommon('noChange')}
              searchPlaceholder={t('searchCategories')}
              items={[
                { value: UNCHANGED, label: tCommon('noChange') },
                { value: NONE, label: t('noneRemoveCategory') },
                ...buildCategoryItems(categories ?? [], undefined, {
                  locale: locale as 'en' | 'es' | 'pt',
                  allPrefix: (name: string): string => tCommon('allOf', { name }),
                }),
              ]}
            />
          </div>

          <div className='border-border flex justify-end gap-3 border-t pt-5'>
            <Button type='button' variant='outline' onClick={(): void => handleOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={(): void => void handleSubmit()}
              disabled={!hasChanges || bulkMutation.isPending}>
              {bulkMutation.isPending ? tCommon('updating') : t('applyChanges')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
