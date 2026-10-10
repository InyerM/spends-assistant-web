'use client';
import { useTranslations } from 'next-intl';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useMonthlyBudgets } from '@/lib/api/queries/budget.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import {
  DASHBOARD_WIDGETS,
  dashboardWidgets,
  moveWidget,
  reorderWidget,
  type DashboardWidget,
} from '@/lib/planning';
export function DashboardControls(): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  const { data } = usePlanning();
  const save = useSavePlanning();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { data: budgets } = useMonthlyBudgets(month);
  const widgets = dashboardWidgets(data?.preferences.dashboard_widgets);
  function update(next: DashboardWidget[]): void {
    save.mutate({
      request_id: crypto.randomUUID(),
      payload: { action: 'preferences', preferences: { dashboard_widgets: next } },
    });
  }
  return (
    <section className='space-y-3'>
      <h2 className='text-base font-semibold'>{t('title')}</h2>
      <p className='text-muted-foreground text-sm'>{t('hint')}</p>
      <div className='divide-border divide-y'>
        {[...widgets, ...DASHBOARD_WIDGETS.filter((id) => !widgets.includes(id))].map((id) => {
          const index = widgets.indexOf(id);
          const available =
            id === 'budgets'
              ? Boolean(budgets?.length)
              : id === 'alerts'
                ? Boolean(budgets?.length || data?.goals.length)
                : id === 'goals'
                  ? Boolean(data?.goals.length || data?.schedules.length)
                  : true;
          return (
            <div
              key={id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!save.isPending)
                  update(reorderWidget(widgets, event.dataTransfer.getData('text/plain'), id));
              }}
              className='flex items-center justify-between gap-3 py-3'>
              <label className='flex min-w-0 items-center gap-3'>
                <Checkbox
                  checked={index >= 0}
                  disabled={save.isPending || (!available && index < 0)}
                  onCheckedChange={(value) =>
                    update(value ? [...widgets, id] : widgets.filter((widget) => widget !== id))
                  }
                />
                <span>
                  {t(id)}
                  {!available && (
                    <span className='text-muted-foreground block text-xs'>{t('requiresData')}</span>
                  )}
                </span>
              </label>
              {index >= 0 && (
                <div className='flex shrink-0 items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    disabled={save.isPending || index === 0}
                    aria-label={t('up', { name: t(id) })}
                    onClick={() => update(moveWidget(widgets, index, -1))}>
                    <ArrowUp className='size-4' aria-hidden='true' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    disabled={save.isPending || index === widgets.length - 1}
                    aria-label={t('down', { name: t(id) })}
                    onClick={() => update(moveWidget(widgets, index, 1))}>
                    <ArrowDown className='size-4' aria-hidden='true' />
                  </Button>
                  <span
                    draggable={!save.isPending}
                    onDragStart={(event) => event.dataTransfer.setData('text/plain', id)}
                    aria-hidden='true'
                    className='text-muted-foreground cursor-grab p-2 active:cursor-grabbing'>
                    <GripVertical className='size-4' />
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {save.error && (
        <p role='alert' className='text-destructive text-sm'>
          {t('error')}
        </p>
      )}
    </section>
  );
}
