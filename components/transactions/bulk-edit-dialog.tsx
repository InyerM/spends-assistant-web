'use client';

import { useState } from 'react';
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
import { CategorySelectItems } from '@/components/shared/category-select-items';
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
      toast.success(`${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''} updated`);
      onOpenChange(false);
      onComplete();
    } catch {
      toast.error('Failed to update transactions');
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
      <DialogContent className='border-border bg-card sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>
            Edit {selectedIds.size} transaction{selectedIds.size > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <p className='text-muted-foreground text-sm'>
            Only changed fields will be updated. Leave as &quot;No change&quot; to keep the current
            value.
          </p>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>No change</SelectItem>
                <SelectSeparator />
                <SelectItem value='expense'>Expense</SelectItem>
                <SelectItem value='income'>Income</SelectItem>
                <SelectItem value='transfer'>Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Account</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>No change</SelectItem>
                <SelectSeparator />
                {accounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.icon ?? '💳'} {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Category</label>
            <Select value={categoryId} onValueChange={(v): void => setCategoryId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCHANGED}>No change</SelectItem>
                <SelectItem value={NONE}>None (remove category)</SelectItem>
                <SelectSeparator />
                <CategorySelectItems categories={categories ?? []} filterType={currentType} />
              </SelectContent>
            </Select>
          </div>

          <div className='flex justify-end gap-3 pt-4'>
            <Button type='button' variant='outline' onClick={(): void => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={(): void => void handleSubmit()}
              disabled={!hasChanges || bulkMutation.isPending}>
              {bulkMutation.isPending ? 'Updating...' : 'Apply Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
