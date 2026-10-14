import { dashboardLayout, type WidgetPlacement } from '@/lib/dashboard-layout';
export interface SavedDashboardLayout {
  name: string;
  items: WidgetPlacement[];
}
export function savedDashboardLayouts(value: unknown): SavedDashboardLayout[] {
  if (!Array.isArray(value)) return [];
  const names = new Set<string>();
  return value
    .flatMap((row: unknown): SavedDashboardLayout[] => {
      if (!row || typeof row !== 'object') return [];
      const record = row as Record<string, unknown>;
      if (typeof record.name !== 'string' || !record.name.trim() || !Array.isArray(record.items))
        return [];
      const name = record.name.trim().slice(0, 60),
        items = dashboardLayout(record.items);
      if (!items.length || names.has(name.toLocaleLowerCase())) return [];
      names.add(name.toLocaleLowerCase());
      return [{ name, items }];
    })
    .slice(0, 5);
}
export function saveDashboardLayout(
  saved: SavedDashboardLayout[],
  name: string,
  items: WidgetPlacement[],
): SavedDashboardLayout[] {
  const label = name.trim().slice(0, 60);
  if (!label || !items.length) return saved;
  const existing = saved.find((row) => row.name.toLocaleLowerCase() === label.toLocaleLowerCase());
  if (!existing && saved.length >= 5) return saved;
  const updated = { name: label, items: dashboardLayout(items) };
  return existing
    ? saved.map((row) => (row === existing ? updated : row))
    : [updated, ...saved].slice(0, 5);
}
