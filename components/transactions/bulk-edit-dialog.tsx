'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildAccountItems, buildCategoryItems } from '@/lib/utils/select-items';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useBulkUpdateTransactions } from '@/lib/api/mutations/transaction.mutations';
import type { TransactionType } from '@/types';

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
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const bulkMutation = useBulkUpdateTransactions();

  const [type, setType] = useState(UNCHANGED);
  const [categoryId, setCategoryId] = useState(UNCHANGED);
  const [accountId, setAccountId] = useState(UNCHANGED);

  const currentType = type === UNCHANGED ? undefined : (type as TransactionType);

  const hasChanges = type !== UNCHANGED || categoryId !== UNCHANGED || accountId !== UNCHANGED;

  const handleSubmit = async (): Promise<void> => {
    const updates: Record<string, unknown> = {};
    if (type !== UNCHANGED) updates.type = type;
    if (categoryId !== UNCHANGED) updates.category_id = categoryId === NONE ? null : categoryId;
    if (accountId !== UNCHANGED) updates.account_id = accountId;

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
      setType(UNCHANGED);
      setCategoryId(UNCHANGED);
      setAccountId(UNCHANGED);
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
            <label className='text-sm font-medium'>{t('type')}</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>{tCommon('noChange')}</SelectItem>
                <SelectSeparator />
                <SelectItem value='expense'>{t('expense')}</SelectItem>
                <SelectItem value='income'>{t('income')}</SelectItem>
                <SelectItem value='transfer'>{t('transfer')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>{t('account')}</label>
            <SearchableSelect
              value={accountId}
              onValueChange={setAccountId}
              placeholder={tCommon('noChange')}
              searchPlaceholder={t('searchAccounts')}
              items={[
                { value: UNCHANGED, label: tCommon('noChange') },
                ...buildAccountItems(accounts ?? []),
              ]}
            />
          </div>

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
                ...buildCategoryItems(categories ?? [], currentType, {
                  locale: locale as 'en' | 'es' | 'pt',
                  allPrefix: (name: string): string => tCommon('allOf', { name }),
                }),
              ]}
            />
          </div>

          <div className='flex justify-end gap-3 pt-4'>
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
