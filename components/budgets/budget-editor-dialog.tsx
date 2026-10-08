'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSaveMonthlyBudget } from '@/lib/api/mutations/budget.mutations';
import type { BudgetStatus } from '@/lib/api/queries/budget.queries';
import type { Category } from '@/types/category';

interface BudgetEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  editing: BudgetStatus | null;
  categories: Category[];
  locale: string;
}

export function BudgetEditorDialog({
  open,
  onOpenChange,
  month,
  editing,
  categories,
  locale,
}: BudgetEditorDialogProps): React.ReactElement {
  const t = useTranslations('budgets');
  const common = useTranslations('common');
  const save = useSaveMonthlyBudget();
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [amount, setAmount] = useState(editing ? String(Number(editing.limit_cop)) : '');
  const parsedAmount = Number(amount);
  const validAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= 9_999_999_999_999.99 &&
    Math.abs(Math.round(parsedAmount * 100) / 100 - parsedAmount) < 1e-9;

  function handleSave(): void {
    if (!categoryId || !validAmount) return;
    save.mutate(
      { month, category_id: categoryId, limit_cop: parsedAmount },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast.success(t('saved'));
        },
        onError: () => toast.error(t('saveFailed')),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('editTitle') : t('newTitle')}</DialogTitle>
          <DialogDescription>{t('formDescription')}</DialogDescription>
        </DialogHeader>
        <div className='space-y-5 py-2'>
          <div className='space-y-2'>
            <Label htmlFor='budget-category'>{t('category')}</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={Boolean(editing)}>
              <SelectTrigger id='budget-category' className='w-full'>
                <SelectValue placeholder={t('selectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.translations?.[locale] || category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='budget-amount'>{t('limitCop')}</Label>
            <Input
              id='budget-amount'
              type='number'
              inputMode='decimal'
              min='0.01'
              step='0.01'
              value={amount}
              onChange={(event): void => setAmount(event.target.value)}
              placeholder='500000'
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={(): void => onOpenChange(false)}>
            {common('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!categoryId || !validAmount || save.isPending}>
            {save.isPending ? common('saving') : common('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
