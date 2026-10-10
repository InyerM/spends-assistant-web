'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import type { SavingsGoal } from '@/lib/planning';
export function GoalForm({
  goal,
  onClose,
}: {
  goal?: SavingsGoal;
  onClose: () => void;
}): React.ReactElement {
  const t = useTranslations('planning');
  const save = useSavePlanning();
  const [name, setName] = useState(goal?.name ?? '');
  const [currency, setCurrency] = useState(goal?.currency ?? 'COP');
  const [target, setTarget] = useState(String(goal?.target_amount ?? ''));
  const [saved, setSaved] = useState(String(goal?.saved_amount ?? 0));
  const [due, setDue] = useState(goal?.due_date ?? '');
  return (
    <form
      className='border-border space-y-4 rounded-xl border p-5'
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          {
            request_id: crypto.randomUUID(),
            payload: {
              action: 'save_goal',
              id: goal?.id ?? crypto.randomUUID(),
              name,
              currency: currency as 'COP' | 'USD',
              target_amount: Number(target),
              saved_amount: Number(saved),
              due_date: due || null,
            },
          },
          { onSuccess: onClose },
        );
      }}>
      <label className='block space-y-2'>
        <span>{t('name')}</span>
        <Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className='grid gap-4 sm:grid-cols-2'>
        <label className='space-y-2'>
          <span>{t('target')}</span>
          <Input
            required
            type='number'
            min='0.01'
            step='0.01'
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        <label className='space-y-2'>
          <span>{t('saved')}</span>
          <Input
            required
            type='number'
            min='0'
            step='0.01'
            value={saved}
            onChange={(e) => setSaved(e.target.value)}
          />
        </label>
      </div>
      <p className='text-muted-foreground text-sm'>{t('trackingOnly')}</p>
      <div className='grid gap-4 sm:grid-cols-2'>
        <SearchableSelect
          ariaLabel={t('currency')}
          value={currency}
          onValueChange={setCurrency}
          items={[
            { value: 'COP', label: 'COP' },
            { value: 'USD', label: 'USD' },
          ]}
        />
        <DatePicker value={due} onChange={setDue} ariaLabel={t('deadline')} />
      </div>
      {save.error && <p role='alert'>{t('saveError')}</p>}
      <div className='flex gap-3'>
        <Button type='submit' disabled={save.isPending}>
          {t('save')}
        </Button>
        <Button type='button' variant='outline' onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
