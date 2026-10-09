'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PiggyBank, Plus } from 'lucide-react';
import { BudgetCard } from '@/components/budgets/budget-card';
import { BudgetEditorDialog } from '@/components/budgets/budget-editor-dialog';
import { BudgetRemoveDialog } from '@/components/budgets/budget-remove-dialog';
import { MonthSelector } from '@/components/dashboard/month-selector';
import { Loader } from '@/components/shared/loader';
import { Button } from '@/components/ui/button';
import { budgetCategoryOptions, currentBudgetMonth } from '@/lib/budgets';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useMonthlyBudgets, type BudgetStatus } from '@/lib/api/queries/budget.queries';

export default function BudgetsPage(): React.ReactElement {
  const t = useTranslations('budgets');
  const locale = useLocale();
  const [month, setMonth] = useState(currentBudgetMonth);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetStatus | null>(null);
  const { data: budgets, isLoading, isError, refetch } = useMonthlyBudgets(month);
  const { data: categories } = useCategories();
  const categoryMap = useMemo(
    () => new Map((categories ?? []).map((category) => [category.id, category])),
    [categories],
  );
  const options = useMemo(() => budgetCategoryOptions(categories ?? []), [categories]);
  const [year, monthNumber] = month.split('-').map(Number);

  function openCreate(): void {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(budget: BudgetStatus): void {
    setEditing(budget);
    setDialogOpen(true);
  }

  return (
    <div className='mx-auto max-w-6xl space-y-8 px-4 py-7 sm:px-6'>
      <header className='flex flex-wrap items-start justify-between gap-5'>
        <div className='max-w-2xl space-y-2'>
          <div className='text-brand flex items-center gap-2 text-xs font-semibold tracking-[0.12em] uppercase'>
            <PiggyBank className='h-4 w-4' />
            {t('eyebrow')}
          </div>
          <h1 className='text-3xl font-semibold tracking-tight'>{t('title')}</h1>
          <p className='text-muted-foreground text-sm leading-6'>{t('description')}</p>
        </div>
        <Button onClick={openCreate} className='cursor-pointer gap-2'>
          <Plus className='h-4 w-4' />
          {t('newBudget')}
        </Button>
      </header>

      <div className='border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3'>
        <p className='text-muted-foreground text-sm'>{t('monthLabel')}</p>
        <MonthSelector
          year={year}
          month={monthNumber - 1}
          onChange={(nextYear, nextMonth): void =>
            setMonth(`${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-01`)
          }
        />
      </div>

      {isLoading ? (
        <div className='flex justify-center py-20'>
          <Loader />
        </div>
      ) : isError ? (
        <div className='border-border bg-card rounded-xl border p-8 text-center'>
          <p className='mb-4'>{t('loadFailed')}</p>
          <Button variant='outline' onClick={(): void => void refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : budgets?.length ? (
        <div className='grid gap-4 lg:grid-cols-2'>
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.budget_id}
              budget={budget}
              category={categoryMap.get(budget.category_id)}
              locale={locale}
              onEdit={(): void => openEdit(budget)}
              onDeactivate={(): void => setDeleteTarget(budget)}
            />
          ))}
        </div>
      ) : (
        <div className='border-border bg-card flex flex-col items-center rounded-xl border px-6 py-16 text-center'>
          <PiggyBank className='text-brand mb-5 h-10 w-10' />
          <h2 className='text-xl font-semibold'>{t('emptyTitle')}</h2>
          <p className='text-muted-foreground mt-2 max-w-md text-sm'>{t('emptyDescription')}</p>
          <Button variant='outline' className='mt-6' onClick={openCreate}>
            {t('newBudget')}
          </Button>
        </div>
      )}

      {dialogOpen && (
        <BudgetEditorDialog
          key={editing?.budget_id ?? 'new'}
          open
          onOpenChange={setDialogOpen}
          month={month}
          editing={editing}
          categories={options}
          locale={locale}
        />
      )}
      {deleteTarget && (
        <BudgetRemoveDialog
          budgetId={deleteTarget.budget_id}
          month={month}
          onClose={(): void => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
