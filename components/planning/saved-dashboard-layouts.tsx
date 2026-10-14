'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Save, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import { savedDashboardLayouts, saveDashboardLayout } from '@/lib/saved-dashboard-layouts';
import type { WidgetPlacement } from '@/lib/dashboard-layout';
export function SavedDashboardLayouts({
  items,
  blocked,
  onApply,
}: {
  items: WidgetPlacement[];
  blocked: boolean;
  onApply: (items: WidgetPlacement[]) => void;
}): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  const [name, setName] = useState('');
  const { data } = usePlanning();
  const save = useSavePlanning();
  const saved = savedDashboardLayouts(data?.preferences.dashboard_saved_layouts);
  const capacityReached =
    saved.length >= 5 &&
    !saved.some((row) => row.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  const disabled = blocked || save.isPending;
  function persist(layouts: typeof saved): void {
    save.mutate(
      {
        request_id: crypto.randomUUID(),
        payload: { action: 'preferences', preferences: { dashboard_saved_layouts: layouts } },
      },
      { onSuccess: () => setName('') },
    );
  }
  return (
    <section className='space-y-2'>
      <h3 className='text-sm font-semibold'>{t('savedLayouts.title')}</h3>
      <form
        className='flex items-center gap-2'
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && !capacityReached && name.trim() && items.length)
            persist(saveDashboardLayout(saved, name, items));
        }}>
        <Input
          aria-label={t('savedLayouts.name')}
          placeholder={t('savedLayouts.name')}
          value={name}
          maxLength={60}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type='submit'
          variant='outline'
          size='icon'
          aria-label={t('savedLayouts.save')}
          disabled={disabled || capacityReached || !name.trim() || !items.length}>
          <Save className='size-4' />
        </Button>
      </form>
      <p className='text-muted-foreground text-xs'>{t('savedLayouts.hint')}</p>
      {save.error && (
        <p role='alert' className='text-destructive text-xs'>
          {t('error')}
        </p>
      )}
      <ul className='space-y-1'>
        {saved.map((row) => (
          <li key={row.name} className='flex min-w-0 items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              className='min-w-0 flex-1 justify-start'
              disabled={disabled}
              onClick={() => onApply(row.items)}>
              <span className='truncate'>{row.name}</span>
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              disabled={disabled}
              aria-label={t('savedLayouts.delete', { name: row.name })}
              onClick={() => persist(saved.filter((other) => other.name !== row.name))}>
              <Trash2 className='size-4' />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
