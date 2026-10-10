'use client';
import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { TimePicker } from '@/components/ui/time-picker';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { useCategories } from '@/lib/api/queries/category.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import { getCategoryName } from '@/lib/i18n/get-category-name';
import type { Locale } from '@/i18n/config';
import type { PlannedExpense, CommonExpense } from '@/lib/planning';
export function ExpenseForm({
  kind,
  expense,
  onClose,
}: {
  kind: 'schedule' | 'common';
  expense?: PlannedExpense | CommonExpense;
  onClose: () => void;
}): React.ReactElement {
  const t = useTranslations('planning');
  const locale = useLocale() as Locale;
  const save = useSavePlanning();
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const schedule = expense && 'cadence' in expense ? expense : undefined;
  const [name, setName] = useState(expense?.name ?? '');
  const [amount, setAmount] = useState(String(expense?.amount ?? ''));
  const [account, setAccount] = useState(expense?.account_id ?? '');
  const [category, setCategory] = useState(expense?.category_id ?? '');
  const [cadence, setCadence] = useState<'monthly' | 'days'>(schedule?.cadence ?? 'monthly');
  const [interval, setInterval] = useState(schedule?.interval_days ?? 30);
  const [date, setDate] = useState(schedule?.next_due ?? new Date().toLocaleDateString('en-CA'));
  const [time, setTime] = useState(schedule?.due_time.slice(0, 5) ?? '09:00');
  const [automatic, setAutomatic] = useState(schedule?.automatic ?? false);
  return (
    <form
      className='border-border space-y-4 rounded-xl border p-5'
      onSubmit={(e) => {
        e.preventDefault();
        const base = {
          id: expense?.id ?? crypto.randomUUID(),
          name,
          amount: Number(amount),
          account_id: account,
          category_id: category || null,
        };
        save.mutate(
          {
            request_id: crypto.randomUUID(),
            payload:
              kind === 'common'
                ? { action: 'save_common', ...base }
                : {
                    action: 'save_schedule',
                    ...base,
                    cadence,
                    interval_days: interval,
                    next_due: date,
                    due_time: time,
                    timezone:
                      schedule?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                    automatic,
                  },
          },
          { onSuccess: onClose },
        );
      }}>
      <label className='block space-y-2'>
        <span>{t('name')}</span>
        <Input required value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className='block space-y-2'>
        <span>{t('amount')}</span>
        <Input
          required
          type='number'
          min='0.01'
          step='0.01'
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <div className='grid gap-4 sm:grid-cols-2'>
        <SearchableSelect
          ariaLabel={t('account')}
          placeholder={t('account')}
          value={account}
          onValueChange={setAccount}
          items={(accounts ?? [])
            .filter((a) => a.currency === 'COP' || a.currency === 'USD')
            .map((a) => ({ value: a.id, label: a.name }))}
        />
        <SearchableSelect
          ariaLabel={t('category')}
          placeholder={t('category')}
          value={category}
          onValueChange={setCategory}
          items={(categories ?? [])
            .filter((c) => c.type === 'expense')
            .map((c) => ({ value: c.id, label: getCategoryName(c, locale) }))}
        />
      </div>
      {kind === 'schedule' && (
        <>
          <SearchableSelect
            ariaLabel={t('cadence')}
            value={cadence}
            onValueChange={(v) => setCadence(v as 'monthly' | 'days')}
            items={[
              { value: 'monthly', label: t('monthly') },
              { value: 'days', label: t('everyDays') },
            ]}
          />
          {cadence === 'days' && (
            <label className='block'>
              <span>{t('interval')}</span>
              <Input
                required
                type='number'
                min={1}
                max={366}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
              />
            </label>
          )}
          <div className='grid gap-4 sm:grid-cols-2'>
            <DatePicker value={date} onChange={setDate} ariaLabel={t('nextDue')} />
            <TimePicker value={time} onChange={setTime} />
          </div>
          <label className='flex items-start gap-3'>
            <Checkbox checked={automatic} onCheckedChange={(v) => setAutomatic(v === true)} />
            <span>
              <strong>{t('automatic')}</strong>
              <span className='text-muted-foreground block text-sm'>{t('automaticHint')}</span>
            </span>
          </label>
        </>
      )}
      {save.error && <p role='alert'>{t('saveError')}</p>}
      <div className='flex gap-3'>
        <Button type='submit' disabled={save.isPending || !account}>
          {t('save')}
        </Button>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
