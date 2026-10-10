'use client';
import { useTranslations } from 'next-intl';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import {
  DASHBOARD_WIDGETS,
  dashboardWidgets,
  moveWidget,
  type DashboardWidget,
} from '@/lib/planning';
export function DashboardControls(): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  const { data } = usePlanning();
  const save = useSavePlanning();
  const widgets = dashboardWidgets(data?.preferences.dashboard_widgets);
  function update(next: DashboardWidget[]): void {
    save.mutate({
      request_id: crypto.randomUUID(),
      payload: { action: 'preferences', preferences: { dashboard_widgets: next } },
    });
  }
  return (
    <details className='border-border bg-card rounded-xl border p-4'>
      <summary className='cursor-pointer text-sm font-medium'>{t('title')}</summary>
      <p className='text-muted-foreground mt-3 text-sm'>{t('hint')}</p>
      <div className='divide-border mt-3 divide-y'>
        {[...widgets, ...DASHBOARD_WIDGETS.filter((id) => !widgets.includes(id))].map((id) => {
          const index = widgets.indexOf(id);
          return (
            <div key={id} className='flex items-center justify-between gap-3 py-2'>
              <label className='flex items-center gap-3'>
                <Checkbox
                  checked={index >= 0}
                  disabled={save.isPending}
                  onCheckedChange={(v) =>
                    update(v ? [...widgets, id] : widgets.filter((w) => w !== id))
                  }
                />
                {t(id)}
              </label>
              {index >= 0 && (
                <div className='flex gap-1'>
                  <Button
                    size='icon'
                    variant='ghost'
                    disabled={save.isPending || index === 0}
                    aria-label={t('up', { name: t(id) })}
                    onClick={() => update(moveWidget(widgets, index, -1))}>
                    <ArrowUp className='size-4' />
                  </Button>
                  <Button
                    size='icon'
                    variant='ghost'
                    disabled={save.isPending || index === widgets.length - 1}
                    aria-label={t('down', { name: t(id) })}
                    onClick={() => update(moveWidget(widgets, index, 1))}>
                    <ArrowDown className='size-4' />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {save.error && <p role='alert'>{t('error')}</p>}
    </details>
  );
}
