'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DASHBOARD_TEMPLATES, dashboardTemplate } from '@/lib/dashboard-templates';
import { DASHBOARD_ZONES, type WidgetPlacement } from '@/lib/dashboard-layout';
import type { DashboardWidget } from '@/lib/planning';
export function DashboardTemplates({
  available,
  disabled,
  onApply,
}: {
  available: DashboardWidget[];
  disabled: boolean;
  onApply: (items: WidgetPlacement[]) => void;
}): React.ReactElement {
  const t = useTranslations('dashboardWidgets');
  return (
    <section className='space-y-2'>
      <h3 className='text-sm font-semibold'>{t('templates.title')}</h3>
      <div className='grid grid-cols-2 gap-2'>
        {DASHBOARD_TEMPLATES.map((template) => {
          const rows = dashboardTemplate(template, available);
          return (
            <Button
              key={template}
              disabled={disabled}
              variant='outline'
              className='h-auto flex-col items-stretch gap-2 p-3 text-left whitespace-normal sm:h-auto'
              onClick={() => onApply(rows)}>
              <span className='text-xs font-medium'>{t(`templates.${template}`)}</span>
              <span aria-hidden='true' className='block space-y-1'>
                {DASHBOARD_ZONES.map((zone) => (
                  <span key={zone} className='grid grid-cols-12 gap-1'>
                    {rows
                      .filter((row) => row.zone === zone)
                      .map((row) => (
                        <span
                          key={row.id}
                          className='bg-brand/20 h-1.5 rounded-sm'
                          style={{ gridColumn: `span ${row.width}` }}
                        />
                      ))}
                  </span>
                ))}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
