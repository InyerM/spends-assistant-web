'use client';
import { useEffect, useRef, useState } from 'react';
import { widgetRowSpan, type WidgetPlacement } from '@/lib/dashboard-layout';
export function WidgetCell({
  item,
  children,
  onDrop,
  onDragOver,
  editing,
}: {
  item: WidgetPlacement;
  children: React.ReactNode;
  onDrop: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  editing: boolean;
}): React.ReactElement {
  const content = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(1);
  useEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = (): void => setSpan(widgetRowSpan(node.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return (): void => observer.disconnect();
  }, []);
  return (
    <div
      data-widget={item.id}
      className={`min-w-0 self-start xl:col-span-(--widget-width) ${editing ? '' : 'has-[.widget-frame:empty]:hidden'}`}
      style={
        {
          '--widget-width': item.width,
          '--widget-chart-height': `${Math.max(200, item.height * 70)}px`,
          gridRowEnd: `span ${span}`,
        } as React.CSSProperties
      }
      onDragOver={(event) => {
        if (editing) {
          event.preventDefault();
          onDragOver?.(event);
        }
      }}
      onDrop={onDrop}>
      <div ref={content}>{children}</div>
    </div>
  );
}
