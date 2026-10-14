import { DASHBOARD_WIDGETS, dashboardWidgets, type DashboardWidget } from '@/lib/planning';
export const DASHBOARD_ZONES = ['overview', 'activity', 'planning'] as const;
export type DashboardZone = (typeof DASHBOARD_ZONES)[number];
export interface WidgetPlacement {
  id: DashboardWidget;
  zone: DashboardZone;
  width: number;
  height: number;
}
export const WIDGET_ZONES: Record<DashboardWidget, DashboardZone> = {
  summary: 'overview',
  usage: 'planning',
  accounts: 'overview',
  trend: 'overview',
  categories: 'activity',
  nature: 'overview',
  recent: 'activity',
  budgets: 'planning',
  goals: 'planning',
  custom: 'activity',
  contacts: 'activity',
  alerts: 'overview',
  reviewInbox: 'overview',
  reviewDocuments: 'overview',
};
const bound = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : fallback;
export function dashboardLayout(value: unknown, legacy?: unknown): WidgetPlacement[] {
  if (!Array.isArray(value)) {
    const ids = Array.isArray(legacy)
      ? dashboardWidgets(['summary', ...dashboardWidgets(legacy), 'usage'])
      : dashboardWidgets(legacy);
    return ids.map((id) => ({
      id,
      zone: WIDGET_ZONES[id],
      width: id === 'summary' || id === 'accounts' || id === 'nature' ? 12 : 6,
      height: id === 'summary' || id === 'usage' ? 2 : 4,
    }));
  }
  const seen = new Set<string>();
  return value.flatMap((item: unknown): WidgetPlacement[] => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (!DASHBOARD_WIDGETS.includes(row.id as DashboardWidget) || seen.has(String(row.id)))
      return [];
    const id = row.id as DashboardWidget;
    seen.add(id);
    return [
      {
        id,
        zone: DASHBOARD_ZONES.includes(row.zone as DashboardZone)
          ? (row.zone as DashboardZone)
          : WIDGET_ZONES[id],
        width: bound(row.width, 6, 4, 12),
        height: bound(row.height, 4, 2, 8),
      },
    ];
  });
}
export function placeWidget(
  items: WidgetPlacement[],
  id: DashboardWidget,
  zone: DashboardZone,
  before?: DashboardWidget,
): WidgetPlacement[] {
  const placement = { ...(items.find((x) => x.id === id) ?? { id, width: 6, height: 4 }), zone };
  const result = items.filter((x) => x.id !== id);
  const index = before ? result.findIndex((x) => x.id === before) : -1;
  result.splice(index < 0 ? result.length : index, 0, placement);
  return result;
}
export function resizeWidget(
  items: WidgetPlacement[],
  id: DashboardWidget,
  width: number,
  height: number,
): WidgetPlacement[] {
  return items.map((x) =>
    x.id === id ? { ...x, width: bound(width, 6, 4, 12), height: bound(height, 4, 2, 8) } : x,
  );
}

export function widgetRowSpan(height: number): number {
  return Math.max(1, Math.ceil((height + 16) / 24));
}
