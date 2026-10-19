'use client';
import { Fragment, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GripVertical, X, Expand, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WidgetCell } from './widget-cell';
import { SearchableSelect } from '@/components/shared/searchable-select';
import { DASHBOARD_WIDGETS, type DashboardWidget } from '@/lib/planning';
import {
  DASHBOARD_ZONES,
  placeWidget,
  resizeWidget,
  type DashboardZone as Zone,
  type WidgetPlacement,
} from '@/lib/dashboard-layout';
export function DashboardZone({
  zone,
  items,
  editing,
  onChange,
  renderWidget,
}: {
  zone: Zone;
  items: WidgetPlacement[];
  editing: boolean;
  onChange: (items: WidgetPlacement[]) => void;
  renderWidget: (id: DashboardWidget) => React.ReactNode;
}): React.ReactElement | null {
  const t = useTranslations('dashboardWidgets');
  const [target, setTarget] = useState<{
    id: DashboardWidget;
    before?: DashboardWidget;
    height: number;
  } | null>(null);
  useEffect(() => {
    if (!editing) return;
    const clear = (): void => setTarget(null);
    window.addEventListener('dragend', clear);
    return (): void => window.removeEventListener('dragend', clear);
  }, [editing]);
  const previewItem = target
    ? placeWidget(items, target.id, zone, target.before).find((x) => x.id === target.id)
    : undefined;
  const rows = items.filter((x) => x.zone === zone);
  function preview(event: React.DragEvent, before?: DashboardWidget): void {
    if (!editing) return;
    const type = event.dataTransfer.types.find((value) =>
      value.startsWith('application/x-anotto-widget-'),
    );
    const id = type?.slice('application/x-anotto-widget-'.length);
    const resolved = DASHBOARD_WIDGETS.find(
      (entry) => entry.toLowerCase() === (id ?? '').toLowerCase(),
    );
    if (!resolved || resolved === before) return;
    event.preventDefault();
    event.stopPropagation();
    setTarget((current) =>
      current?.id === resolved && current.before === before
        ? current
        : {
            id: resolved,
            before,
            height:
              document.querySelector(`[data-widget="${resolved}"]`)?.getBoundingClientRect()
                .height || 96,
          },
    );
  }
  if (!editing && !rows.length) return null;
  function drop(event: React.DragEvent, before?: DashboardWidget): void {
    event.preventDefault();
    event.stopPropagation();
    const id = event.dataTransfer.getData('text/plain') as DashboardWidget;
    if (editing && DASHBOARD_WIDGETS.includes(id))
      onChange(placeWidget(items, id, zone, before ?? target?.before));
    setTarget(null);
  }
  const previewNode =
    target && previewItem ? (
      <div
        key='drop-preview'
        role='status'
        aria-label={t('dropPreview')}
        data-preview-width={previewItem.width}
        className='border-brand bg-brand/10 pointer-events-auto min-h-20 rounded-xl border-2 border-dashed xl:col-span-(--widget-width)'
        style={
          {
            '--widget-width': previewItem.width,
            height: target.height,
            gridRowEnd: `span ${Math.max(4, Math.ceil((target.height + 16) / 24))}`,
          } as React.CSSProperties
        }
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onDrop={(event) => drop(event, target.before)}>
        <span className='text-brand p-3 text-xs'>
          {t(previewItem.id)} · {t('columns', { count: previewItem.width })}
        </span>
      </div>
    ) : null;
  return (
    <section
      className={editing ? 'border-primary/30 rounded-xl border border-dashed p-3' : 'space-y-3'}
      onDragOver={(event) => preview(event)}
      onDragLeave={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          setTarget(null);
      }}
      onDragEnd={() => setTarget(null)}
      onDrop={drop}>
      <h2 className='text-muted-foreground mb-3 text-sm font-medium'>{t(`zones.${zone}`)}</h2>
      <div className='grid auto-rows-[8px] grid-cols-1 items-start gap-4 xl:grid-cols-12'>
        {rows.map((item) => (
          <Fragment key={item.id}>
            {target?.before === item.id && previewItem && previewNode}
            <WidgetCell
              key={item.id}
              item={item}
              editing={editing}
              onDragOver={(event) => preview(event, item.id)}
              onDrop={(event) => drop(event, item.id)}>
              {editing && (
                <div className='border-primary/30 bg-primary/5 mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1'>
                  <span
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/plain', item.id);
                      event.dataTransfer.setData(`application/x-anotto-widget-${item.id}`, item.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    className='cursor-grab p-2 active:cursor-grabbing'
                    aria-hidden='true'>
                    <GripVertical className='size-4' />
                  </span>
                  <span className='flex-1 text-xs font-medium'>{t(item.id)}</span>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='size-8'
                    disabled={rows.indexOf(item) === 0}
                    aria-label={t('up', { name: t(item.id) })}
                    onClick={() =>
                      onChange(placeWidget(items, item.id, zone, rows[rows.indexOf(item) - 1]?.id))
                    }>
                    <ArrowUp className='size-4' />
                  </Button>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='size-8'
                    disabled={rows.indexOf(item) === rows.length - 1}
                    aria-label={t('down', { name: t(item.id) })}
                    onClick={() => {
                      const index = rows.indexOf(item);
                      onChange(placeWidget(items, item.id, zone, rows[index + 2]?.id));
                    }}>
                    <ArrowDown className='size-4' />
                  </Button>
                  <span role='status' className='text-muted-foreground text-xs tabular-nums'>
                    {item.width} · {item.id === 'trend' ? item.height : t('autoHeight')}
                  </span>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='size-8'
                    aria-label={t('remove', { name: t(item.id) })}
                    onClick={() => onChange(items.filter((x) => x.id !== item.id))}>
                    <X className='size-4' />
                  </Button>
                  <div className='grid w-full grid-cols-2 gap-2 pb-1'>
                    <SearchableSelect
                      className='col-span-2'
                      ariaLabel={t('zone')}
                      value={zone}
                      items={DASHBOARD_ZONES.map((z) => ({ value: z, label: t(`zones.${z}`) }))}
                      onValueChange={(value) =>
                        onChange(placeWidget(items, item.id, value as Zone))
                      }
                    />
                    <SearchableSelect
                      ariaLabel={t('width')}
                      value={String(item.width)}
                      items={[4, 6, 8, 12].map((x) => ({
                        value: String(x),
                        label: t('columns', { count: x }),
                      }))}
                      onValueChange={(value) =>
                        onChange(resizeWidget(items, item.id, Number(value), item.height))
                      }
                    />
                    {item.id === 'trend' && (
                      <SearchableSelect
                        ariaLabel={t('height')}
                        value={String(item.height)}
                        items={[2, 3, 4, 6, 8].map((x) => ({
                          value: String(x),
                          label: t('rows', { count: x }),
                        }))}
                        onValueChange={(value) =>
                          onChange(resizeWidget(items, item.id, item.width, Number(value)))
                        }
                      />
                    )}
                  </div>
                </div>
              )}
              <div className='widget-frame min-w-0'>{renderWidget(item.id)}</div>
              {editing && (
                <button
                  type='button'
                  aria-label={t('resize', { name: t(item.id) })}
                  className='text-muted-foreground mt-1 flex w-full cursor-nwse-resize touch-none justify-end p-1 focus-visible:outline-2'
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    event.currentTarget.dataset.startX = String(event.clientX);
                    event.currentTarget.dataset.startY = String(event.clientY);
                    event.currentTarget.dataset.width = String(item.width);
                    event.currentTarget.dataset.height = String(item.height);
                  }}
                  onPointerMove={(event) => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    const node = event.currentTarget;
                    onChange(
                      resizeWidget(
                        items,
                        item.id,
                        Number(node.dataset.width) +
                          Math.round((event.clientX - Number(node.dataset.startX)) / 64),
                        Number(node.dataset.height) +
                          (item.id === 'trend'
                            ? Math.round((event.clientY - Number(node.dataset.startY)) / 56)
                            : 0),
                      ),
                    );
                  }}
                  onPointerUp={(event) =>
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }>
                  <Expand className='size-3' />
                </button>
              )}
            </WidgetCell>
          </Fragment>
        ))}
        {target && !target.before && previewItem && previewNode}
        {editing && !rows.length && (
          <p className='text-muted-foreground col-span-full py-12 text-center text-sm'>
            {t('dropHere')}
          </p>
        )}
      </div>
    </section>
  );
}
