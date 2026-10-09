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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BudgetComparisonFields } from '@/components/budgets/budget-comparison-fields';
import { currentBudgetMonth, shiftBudgetMonth } from '@/lib/budgets';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { buildCategoryItems } from '@/lib/utils/select-items';
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
  onSavedMonth?: (month: string) => void;
}

export function BudgetEditorDialog({
  open,
  onOpenChange,
  month,
  editing,
  categories,
  locale,
  onSavedMonth,
}: BudgetEditorDialogProps): React.ReactElement {
  const t = useTranslations('budgets');
  const common = useTranslations('common');
  const transactions = useTranslations('transactions');
  const save = useSaveMonthlyBudget();
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? '');
  const [amount, setAmount] = useState(editing ? String(Number(editing.limit_cop)) : '');
  const [repeatMonthly, setRepeatMonthly] = useState(editing?.repeat_monthly ?? false);
  const currentMonth = currentBudgetMonth();
  const [comparePrevious, setComparePrevious] = useState(!editing && month < currentMonth);
  const [comparisonMonth, setComparisonMonth] = useState(
    month < currentMonth ? month : shiftBudgetMonth(currentMonth, -1),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const selectedMonth = comparePrevious ? comparisonMonth : month;
  const parsedAmount = Number(amount);
  const validAmount =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= 9_999_999_999_999.99 &&
    Math.abs(Math.round(parsedAmount * 100) / 100 - parsedAmount) < 1e-9;

  function handleSave(): void {
    if (!categoryId || !validAmount || (comparePrevious && selectedMonth >= currentMonth)) return;
    setSaveError(null);
    save.mutate(
      {
        ...(editing ? { budget_id: editing.budget_id } : {}),
        month: selectedMonth,
        category_id: categoryId,
        limit_cop: parsedAmount,
        repeat_monthly: comparePrevious ? false : repeatMonthly,
      },
      {
        onSuccess: () => {
          onSavedMonth?.(selectedMonth);
          onOpenChange(false);
          toast.success(t('saved'));
        },
        onError: (error) =>
          setSaveError(
            t(error.message === 'budget_collision' ? 'categoryCollision' : 'saveFailed'),
          ),
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
          {!editing && (
            <BudgetComparisonFields
              enabled={comparePrevious}
              onEnabledChange={setComparePrevious}
              month={comparisonMonth}
              currentMonth={currentMonth}
              onMonthChange={setComparisonMonth}
            />
          )}
          {!comparePrevious && (
            <div className='space-y-2'>
              <Label htmlFor='budget-duration'>{t('duration')}</Label>
              <Select
                value={repeatMonthly ? 'monthly' : 'once'}
                onValueChange={(value) => setRepeatMonthly(value === 'monthly')}>
                <SelectTrigger id='budget-duration' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='once'>{t('onlyThisMonth')}</SelectItem>
                  <SelectItem value='monthly'>{t('repeatMonthly')}</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-sm'>
                {t(repeatMonthly ? 'repeatHint' : 'onceHint')}
              </p>
            </div>
          )}
          <div className='space-y-2'>
            <Label htmlFor='budget-category'>{t('category')}</Label>
            <SearchableSelect
              id='budget-category'
              value={categoryId}
              onValueChange={setCategoryId}
              ariaLabel={t('category')}
              placeholder={t('selectCategory')}
              searchPlaceholder={transactions('searchCategories')}
              emptyText={common('noResults')}
              items={buildCategoryItems(categories, undefined, {
                locale: locale as 'en' | 'es' | 'pt',
                allPrefix: (name: string): string => common('allOf', { name }),
              })}
              disabled={save.isPending}
            />
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
        {saveError && (
          <p role='alert' className='text-destructive text-sm'>
            {saveError}
          </p>
        )}
        <DialogFooter>
          <Button variant='outline' onClick={(): void => onOpenChange(false)}>
            {common('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !categoryId ||
              !validAmount ||
              save.isPending ||
              (comparePrevious && selectedMonth >= currentMonth)
            }>
            {save.isPending ? common('saving') : common('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
