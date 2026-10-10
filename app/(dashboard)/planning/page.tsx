'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Pencil, Trash2, Plus, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import { GoalForm } from '@/components/planning/goal-form';
import { ExpenseForm } from '@/components/planning/expense-form';
import { useTransactionFormStore } from '@/lib/stores/transaction-form.store';
import type { SavingsGoal, PlannedExpense, CommonExpense } from '@/lib/planning';
export default function PlanningPage(): React.ReactElement {
  const t = useTranslations('planning');
  const locale = useLocale();
  const { data, isPending, isError } = usePlanning();
  const save = useSavePlanning();
  const openDraft = useTransactionFormStore((s) => s.openDraft);
  const [tab, setTab] = useState<'goals' | 'schedules' | 'common'>('goals');
  const [editor, setEditor] = useState<{
    kind: 'goal' | 'schedule' | 'common';
    value?: SavingsGoal | PlannedExpense | CommonExpense;
  } | null>(null);
  const money = (n: number, c: string): string =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: c }).format(n);
  function archive(kind: 'goal' | 'schedule' | 'common', id: string): void {
    save.mutate({ request_id: crypto.randomUUID(), payload: { action: `archive_${kind}`, id } });
  }
  return (
    <div className='mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6'>
      <header className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('title')}</h1>
          <p className='text-muted-foreground mt-2'>{t('subtitle')}</p>
        </div>
        <Button
          onClick={() =>
            setEditor({
              kind: tab === 'goals' ? 'goal' : tab === 'schedules' ? 'schedule' : 'common',
            })
          }>
          <Plus className='mr-2 size-4' />
          {t('add')}
        </Button>
      </header>
      <div className='flex flex-wrap gap-2' role='tablist' aria-label={t('title')}>
        {(['goals', 'schedules', 'common'] as const).map((id) => (
          <Button
            key={id}
            role='tab'
            aria-selected={tab === id}
            variant={tab === id ? 'default' : 'outline'}
            onClick={() => {
              setTab(id);
              setEditor(null);
            }}>
            {t(id)}
          </Button>
        ))}
      </div>
      {editor?.kind === 'goal' && (
        <GoalForm
          key={editor.value?.id ?? 'new'}
          goal={editor.value as SavingsGoal | undefined}
          onClose={() => setEditor(null)}
        />
      )}
      {editor && editor.kind !== 'goal' && (
        <ExpenseForm
          key={editor.value?.id ?? 'new'}
          kind={editor.kind}
          expense={editor.value as PlannedExpense | CommonExpense | undefined}
          onClose={() => setEditor(null)}
        />
      )}
      {isPending && <p role='status'>{t('loading')}</p>}
      {isError && <p role='alert'>{t('loadError')}</p>}
      {save.error && <p role='alert'>{t('saveError')}</p>}
      <div className='grid gap-4 md:grid-cols-2'>
        {tab === 'goals' &&
          (data?.goals ?? []).map((goal) => (
            <article
              key={goal.id}
              className='border-border bg-card min-w-0 space-y-4 rounded-xl border p-5'>
              <div className='flex items-center justify-between gap-3'>
                <h2 className='truncate font-semibold'>{goal.name}</h2>
                <div className='flex gap-2'>
                  <Button
                    size='icon'
                    variant='ghost'
                    aria-label={t('editGoal')}
                    onClick={() => setEditor({ kind: 'goal', value: goal })}>
                    <Pencil className='size-4' />
                  </Button>
                  <Button
                    size='icon'
                    variant='ghost'
                    aria-label={t('archive')}
                    onClick={() => archive('goal', goal.id)}>
                    <Trash2 className='size-4' />
                  </Button>
                </div>
              </div>
              <p>
                {money(goal.saved_amount, goal.currency)} /{' '}
                {money(goal.target_amount, goal.currency)}
              </p>
              <div
                role='progressbar'
                aria-label={goal.name}
                aria-valuenow={Math.min(100, (100 * goal.saved_amount) / goal.target_amount)}
                aria-valuemin={0}
                aria-valuemax={100}
                className='bg-primary/15 h-2 overflow-hidden rounded-full'>
                <div
                  className='bg-primary h-full'
                  style={{
                    width: `${Math.min(100, (100 * goal.saved_amount) / goal.target_amount)}%`,
                  }}
                />
              </div>
              <p className='text-muted-foreground text-sm'>
                {goal.saved_amount >= goal.target_amount
                  ? t('goalReached')
                  : t('remaining', {
                      amount: money(
                        Math.max(0, goal.target_amount - goal.saved_amount),
                        goal.currency,
                      ),
                    })}
              </p>
            </article>
          ))}
        {tab !== 'goals' &&
          (
            (tab === 'schedules' ? data?.schedules : data?.common) as
              | (PlannedExpense | CommonExpense)[]
              | undefined
          )?.map((expense: PlannedExpense | CommonExpense) => (
            <article
              key={expense.id}
              className='border-border bg-card min-w-0 space-y-3 rounded-xl border p-5'>
              <h2 className='font-semibold break-words'>{expense.name}</h2>
              <p>
                {t('amount')}: {new Intl.NumberFormat(locale).format(expense.amount)}
              </p>
              {'next_due' in expense && (
                <>
                  <p className='text-muted-foreground text-sm'>
                    {expense.next_due} · {expense.due_time.slice(0, 5)} · {expense.timezone}
                  </p>
                  <p>{expense.automatic ? t('automatic') : t('reviewBeforePosting')}</p>
                  {expense.last_error && (
                    <p className='text-sm text-amber-500'>{t('needsReview')}</p>
                  )}
                </>
              )}
              <div className='flex flex-wrap gap-2'>
                <Button
                  variant='outline'
                  onClick={() =>
                    setEditor({ kind: tab === 'schedules' ? 'schedule' : 'common', value: expense })
                  }>
                  {t('edit')}
                </Button>
                {tab === 'common' && (
                  <Button
                    onClick={() =>
                      openDraft({
                        amount: expense.amount,
                        description: expense.name,
                        type: 'expense',
                        account_id: expense.account_id,
                        category_id: expense.category_id ?? undefined,
                      })
                    }>
                    <ArrowUpRight className='mr-2 size-4' />
                    {t('reviewExpense')}
                  </Button>
                )}
                <Button
                  variant='ghost'
                  onClick={() => archive(tab === 'schedules' ? 'schedule' : 'common', expense.id)}>
                  {t('archive')}
                </Button>
              </div>
            </article>
          ))}
      </div>
      {data &&
        (tab === 'goals' ? data.goals : tab === 'schedules' ? data.schedules : data.common)
          .length === 0 && (
          <p className='text-muted-foreground rounded-xl border border-dashed p-8 text-center'>
            {t('empty')}
          </p>
        )}
    </div>
  );
}
