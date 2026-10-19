'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SlidersHorizontal, GripVertical, Plus, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useMonthlyBudgets } from '@/lib/api/queries/budget.queries';
import { usePlanning } from '@/lib/api/queries/planning.queries';
import { useSavePlanning } from '@/lib/api/mutations/planning.mutations';
import { DASHBOARD_WIDGETS } from '@/lib/planning';
import {
  DASHBOARD_ZONES,
  WIDGET_ZONES,
  dashboardLayout,
  placeWidget,
  type WidgetPlacement,
} from '@/lib/dashboard-layout';
import { SavedDashboardLayouts } from './saved-dashboard-layouts';
import { DashboardTemplates } from './dashboard-templates';
import { WidgetPreview } from './widget-preview';
import { CustomChartBuilder } from './custom-chart-builder';
export function DashboardEditor({
  draft,
  onDraft,
}: {
  draft: WidgetPlacement[] | null;
  onDraft: (value: WidgetPlacement[] | null) => void;
}): React.ReactElement {
  const t = useTranslations('dashboardWidgets'),
    common = useTranslations('common');
  const { data, isPending } = usePlanning();
  const date = new Date();
  const { data: budgets } = useMonthlyBudgets(
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
  );
  const save = useSavePlanning();
  const [open, setOpen] = useState(false);
  const [reveal, setReveal] = useState<string | null>(null);
  useEffect(() => {
    if (!reveal) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector(`[data-widget="${reveal}"]`)?.scrollIntoView({
        block: 'center',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      setReveal(null);
    });
    return (): void => cancelAnimationFrame(frame);
  }, [reveal, draft]);
  const blocked = isPending || !data || save.isPending;
  const items =
    draft ??
    dashboardLayout(data?.preferences.dashboard_layout, data?.preferences.dashboard_widgets);
  function close(): void {
    setOpen(false);
    onDraft(null);
  }
  return (
    <>
      <Button
        size='sm'
        variant='outline'
        disabled={blocked}
        onClick={() => {
          onDraft(items);
          setOpen(true);
        }}>
        <SlidersHorizontal className='size-4' aria-hidden='true' />
        {t('editView')}
      </Button>
      <Sheet
        open={open}
        modal={false}
        onOpenChange={(value) => {
          if (!value) close();
        }}>
        <SheetContent
          className='w-full sm:max-w-[380px]'
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}>
          <SheetHeader>
            <SheetTitle>{t('editView')}</SheetTitle>
            <SheetDescription>{t('canvasHint')}</SheetDescription>
          </SheetHeader>
          <div className='min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4'>
            <p className='text-muted-foreground text-xs'>
              {t('selected', { count: items.length })}
            </p>
            <SavedDashboardLayouts items={items} blocked={blocked} onApply={onDraft} />
            <DashboardTemplates
              disabled={blocked}
              available={DASHBOARD_WIDGETS.filter((id) =>
                id === 'budgets'
                  ? Boolean(budgets?.length)
                  : id === 'goals'
                    ? Boolean(data?.goals.length || data?.schedules.length)
                    : id === 'alerts'
                      ? Boolean(budgets?.length || data?.goals.length)
                      : id === 'custom'
                        ? Boolean(
                            Array.isArray(data?.preferences.dashboard_custom_charts) &&
                            data.preferences.dashboard_custom_charts.length,
                          )
                        : true,
              )}
              onApply={onDraft}
            />
            {DASHBOARD_ZONES.map((zone) => (
              <section key={zone} className='space-y-2'>
                <h3 className='font-semibold'>{t(`zones.${zone}`)}</h3>
                <div className='grid grid-cols-2 gap-2'>
                  {DASHBOARD_WIDGETS.filter((id) => WIDGET_ZONES[id] === zone).map((id) => {
                    const selected = items.some((x) => x.id === id);
                    const available =
                      id === 'budgets'
                        ? Boolean(budgets?.length)
                        : id === 'goals'
                          ? Boolean(data?.goals.length || data?.schedules.length)
                          : id === 'alerts'
                            ? Boolean(budgets?.length || data?.goals.length)
                            : true;
                    return (
                      <div
                        key={id}
                        className={`rounded-xl border p-2 ${selected ? 'border-primary/50' : 'border-border'}`}
                        draggable={!blocked && available}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', id);
                          event.dataTransfer.setData(`application/x-anotto-widget-${id}`, id);
                          event.dataTransfer.effectAllowed = 'move';
                        }}>
                        <WidgetPreview id={id} />
                        {!available && (
                          <p className='text-muted-foreground mt-1 text-[11px]'>
                            {t('requiresData')}
                          </p>
                        )}
                        <div className='mt-2 flex items-center gap-1'>
                          <GripVertical
                            className='text-muted-foreground size-3 shrink-0'
                            aria-hidden='true'
                          />
                          <span className='min-w-0 flex-1 text-xs font-medium'>{t(id)}</span>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-8 shrink-0'
                            disabled={blocked || !available}
                            aria-label={t(selected ? 'remove' : 'add', { name: t(id) })}
                            onClick={() => {
                              onDraft(
                                selected
                                  ? items.filter((x) => x.id !== id)
                                  : placeWidget(items, id, zone),
                              );
                              if (!selected) setReveal(id);
                            }}>
                            {selected ? (
                              <Check className='text-primary size-4' />
                            ) : (
                              <Plus className='size-4' />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            <details className='border-border border-t pt-3'>
              <summary className='cursor-pointer text-sm font-medium'>{t('createChart')}</summary>
              <div className='mt-4'>
                <CustomChartBuilder />
              </div>
            </details>
          </div>
          <div className='border-border space-y-2 border-t p-4'>
            {save.error && (
              <p role='alert' className='text-destructive text-xs'>
                {t('error')}
              </p>
            )}
            <Button
              variant='ghost'
              size='sm'
              disabled={blocked}
              onClick={() => onDraft(dashboardLayout(undefined))}>
              <RotateCcw className='size-4' />
              {t('reset')}
            </Button>
            <div className='grid grid-cols-2 gap-2'>
              <Button variant='outline' disabled={save.isPending} onClick={close}>
                {common('cancel')}
              </Button>
              <Button
                disabled={blocked}
                onClick={() =>
                  save.mutate(
                    {
                      request_id: crypto.randomUUID(),
                      payload: {
                        action: 'preferences',
                        preferences: {
                          dashboard_layout: items,
                          dashboard_widgets: items.map((x) => x.id),
                        },
                      },
                    },
                    { onSuccess: close },
                  )
                }>
                {common(save.isPending ? 'saving' : 'save')}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
