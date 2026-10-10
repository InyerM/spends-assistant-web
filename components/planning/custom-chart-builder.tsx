'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { useAccounts } from '@/lib/api/queries/account.queries';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import { customCharts, type CustomChart } from '@/lib/custom-charts';
export function CustomChartBuilder(): React.ReactElement {
  const t = useTranslations('customCharts');
  const { data } = usePlanning();
  const { data: accounts } = useAccounts();
  const save = useSavePlanning();
  const charts = customCharts(data?.preferences.dashboard_custom_charts);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CustomChart['currency']>('COP');
  const [type, setType] = useState<CustomChart['type']>('expense');
  const [group, setGroup] = useState<CustomChart['group']>('category');
  const [account, setAccount] = useState('');
  function update(next: CustomChart[]): void {
    save.mutate({
      request_id: crypto.randomUUID(),
      payload: { action: 'preferences', preferences: { dashboard_custom_charts: next } },
    });
  }
  return (
    <section className='space-y-3'>
      <h2 className='text-base font-semibold'>{t('title')}</h2>
      <p className='text-muted-foreground mt-3 text-sm'>{t('hint')}</p>
      <div className='mt-3 space-y-2'>
        {charts.map((chart, index) => (
          <div className='flex flex-wrap items-center gap-2' key={chart.id}>
            <span className='min-w-0 flex-1 break-words'>
              {chart.name} · {chart.currency}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={index === 0 || save.isPending}
              onClick={() => {
                const next = [...charts];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                update(next);
              }}>
              {t('up')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={save.isPending}
              onClick={() => update(charts.filter((c) => c.id !== chart.id))}>
              {t('remove')}
            </Button>
          </div>
        ))}
      </div>
      {charts.length < 3 && (
        <form
          className='mt-4 grid gap-3 sm:grid-cols-2'
          onSubmit={(e) => {
            e.preventDefault();
            update([
              ...charts,
              { id: crypto.randomUUID(), name: name.trim(), currency, type, group, account },
            ]);
            setName('');
          }}>
          <label className='space-y-1 text-sm'>
            <span>{t('name')}</span>
            <Input value={name} required maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className='space-y-1 text-sm'>
            <span>{t('currency')}</span>
            <SearchableSelect
              ariaLabel={t('currency')}
              value={currency}
              items={['COP', 'USD'].map((value) => ({ value, label: value }))}
              onValueChange={(value) => setCurrency(value as CustomChart['currency'])}
            />
          </label>
          <label className='space-y-1 text-sm'>
            <span>{t('type')}</span>
            <SearchableSelect
              ariaLabel={t('type')}
              value={type}
              items={['expense', 'income'].map((value) => ({ value, label: t(value) }))}
              onValueChange={(value) => setType(value as CustomChart['type'])}
            />
          </label>
          <label className='space-y-1 text-sm'>
            <span>{t('group')}</span>
            <SearchableSelect
              ariaLabel={t('group')}
              value={group}
              items={['category', 'account'].map((value) => ({ value, label: t(value) }))}
              onValueChange={(value) => setGroup(value as CustomChart['group'])}
            />
          </label>
          <label className='space-y-1 text-sm'>
            <span>{t('filter')}</span>
            <SearchableSelect
              placeholder={t('all')}
              ariaLabel={t('filter')}
              value={account}
              items={[
                { value: '', label: t('all') },
                ...(accounts ?? []).map((a) => ({ value: a.id, label: a.name })),
              ]}
              onValueChange={setAccount}
            />
          </label>
          <Button className='self-end' disabled={save.isPending || !name.trim()}>
            {t('add')}
          </Button>
        </form>
      )}
      {save.error && (
        <p role='alert' className='text-destructive mt-3'>
          {t('error')}
        </p>
      )}
    </section>
  );
}
